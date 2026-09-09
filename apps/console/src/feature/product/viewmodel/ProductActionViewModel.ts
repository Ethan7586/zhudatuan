import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { actionState, presentError, type ProductStatus, type ProductType } from '@shop/presentation';
import { OP_CATALOG_LISTINGS_PRICE_SET, OP_CATALOG_MEDIAUPLOADS_CREATE, OP_CATALOG_PRODUCTS_CREATE, OP_CATALOG_PRODUCTS_UPDATE } from '@shop/contract/ids';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ProductAction } from '../model/ProductAction';
import type { ProductImage, ProductImageProgress } from '../model/Product';
import { productImageError } from '../model/ProductImagePolicy';
import type { ProductCommand } from '../public';
import { identityFor, type CommandIdentity } from '../../../shared/action/CommandIdentity';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';

export function useProductActionViewModel(action: ProductAction | null, context: ConsoleContext, dependencies: ProductDependencies, requestStepup: () => void, onDone: () => void) {
  const listing = action !== null && 'listing' in action ? action.listing : undefined;
  const allowed = action === null || canUseOperation(context, action.operation);
  const [title, setTitle] = useState(listing?.title ?? '');
  const [category, setCategory] = useState(listing?.category_id ?? '');
  const [type, setType] = useState<ProductType>('physical');
  const [status, setStatus] = useState<ProductStatus>(action?.operation === OP_CATALOG_PRODUCTS_UPDATE ? action.status : 'draft');
  const [amount, setAmount] = useState('');
  const [image, setImage] = useState<File | null | undefined>(undefined);
  const [imageError, setImageError] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<'idle' | 'checking' | 'uploading' | 'saving'>('idle');
  const [imageProgress, setImageProgress] = useState<ProductImageProgress | undefined>(undefined);
  const [uploadedImage, setUploadedImage] = useState<Readonly<{ key: string; receipt: ProductImage }> | undefined>(undefined);
  const actionkey = action === null ? 'closed' : `${action.operation}:${listing?.id ?? 'new'}`;
  const canUploadImage = canUseOperation(context, OP_CATALOG_MEDIAUPLOADS_CREATE);
  const commandidentity = useRef<CommandIdentity | undefined>(undefined);
  useEffect(() => {
    setTitle(listing?.title ?? '');
    setCategory(listing?.category_id ?? '');
    setType('physical');
    setStatus(action?.operation === OP_CATALOG_PRODUCTS_UPDATE ? action.status : 'draft');
    setAmount('');
    setImage(undefined);
    setImageError(undefined);
    setPhase('idle');
    setImageProgress(undefined);
    setUploadedImage(undefined);
  }, [actionkey, action, listing]);
  const identity = identityFor(commandidentity, JSON.stringify({ actionkey, amount, category, status, title, type, image: imageSignature(image) }), dependencies.createIdentity);
  const mutation = useMutation({
    mutationKey: ['productaction', actionkey],
    mutationFn: async () => {
      if (action === null) throw new Error('PRODUCT_ACTION_MISSING');
      const request = command(context, identity);
      const uploaded = image instanceof File ? await uploadImage(dependencies, request, image, uploadedImage, setUploadedImage, setPhase, setImageProgress) : image;
      setPhase('saving');
      if (action.operation === OP_CATALOG_PRODUCTS_CREATE)
        return dependencies.executeAction.execute(request, {
          operation: action.operation,
          body: { title: title.trim(), category: category.trim(), type, ...(uploaded === undefined || uploaded === null ? {} : { image: uploaded }) },
        });
      if (action.operation === OP_CATALOG_PRODUCTS_UPDATE)
        return dependencies.executeAction.execute(request, {
          operation: action.operation,
          listing: action.listing,
          expectedVersion: action.expectedVersion,
          body: { title: title.trim(), category: category.trim(), status, ...(uploaded === undefined ? {} : { image: uploaded }) },
        });
      if (action.operation === OP_CATALOG_LISTINGS_PRICE_SET)
        return dependencies.executeAction.execute(request, { operation: action.operation, listing: action.listing, expectedVersion: action.expectedVersion, body: { amountMinor: priceMinor(amount), currency: 'CNY' } });
      return dependencies.executeAction.execute(request, action);
    },
    onSuccess: onDone,
    onSettled: () => {
      setPhase('idle');
      setImageProgress(undefined);
    },
  });
  const state = actionState({ pending: mutation.isPending, commandId: identity, ...(mutation.data === undefined ? {} : { result: mutation.data }), ...(mutation.error === null ? {} : { error: mutation.error }) });
  const error = mutation.error === null ? undefined : `${presentError(mutation.error).message}${image instanceof File ? ' 图片已保留，无需重新选择，可直接重试。' : ''}`;
  return Object.freeze({
    action,
    allowed,
    permissionReason: allowed ? undefined : '当前账号不能执行这项商品操作。',
    state,
    title,
    category,
    type,
    status,
    amount,
    image,
    imageError,
    currentImage: typeof listing?.cover_url === 'string' && listing.cover_url !== '' ? listing.cover_url : undefined,
    canUploadImage,
    imagePermissionReason: canUploadImage ? undefined : '当前账号不能上传商品图片，仍可保存文字信息或移除已有图片。',
    phase,
    imageProgress,
    submittingLabel: phase === 'checking' ? '正在校验图片…' : phase === 'uploading' ? '正在上传图片…' : '正在保存…',
    submitting: mutation.isPending,
    ...(error === undefined ? {} : { error }),
    setTitle,
    setCategory,
    setType,
    setStatus,
    setAmount,
    chooseImage: (file: File) => {
      const message = productImageError(file);
      setImageError(message);
      setUploadedImage(undefined);
      mutation.reset();
      if (message === undefined && canUploadImage) setImage(file);
      else setImage(undefined);
    },
    removeImage: () => {
      setImage(action?.operation === OP_CATALOG_PRODUCTS_UPDATE ? null : undefined);
      setImageError(undefined);
      setUploadedImage(undefined);
      mutation.reset();
    },
    submit: () => {
      if (!allowed || imageError !== undefined || (image instanceof File && !canUploadImage) || mutation.isPending || action === null) return;
      const assurance = Math.max(requiredAssurance(action.operation), image instanceof File ? requiredAssurance(OP_CATALOG_MEDIAUPLOADS_CREATE) : 0);
      if (context.session.assurance.level < assurance) {
        requestStepup();
        return;
      }
      mutation.mutate();
    },
  });
}

export function command(context: ConsoleContext, identity: string): ProductCommand {
  return Object.freeze({ scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, identity, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) });
}

export type ProductActionViewModel = ReturnType<typeof useProductActionViewModel>;

function priceMinor(value: string): number {
  const parsed = Number(value);
  const minor = Math.round(parsed * 100);
  if (!Number.isFinite(parsed) || minor <= 0 || minor > 99_999_999) throw new Error('销售价必须介于 0.01 与 999999.99 元之间');
  return minor;
}

function imageSignature(image: File | null | undefined): string {
  if (image === undefined) return 'preserve';
  if (image === null) return 'remove';
  return `${image.name}\u0000${image.size}\u0000${image.type}\u0000${image.lastModified}`;
}

async function uploadImage(
  dependencies: ProductDependencies,
  request: ProductCommand,
  image: File,
  cached: Readonly<{ key: string; receipt: ProductImage }> | undefined,
  cache: (value: Readonly<{ key: string; receipt: ProductImage }>) => void,
  setPhase: (phase: 'idle' | 'checking' | 'uploading' | 'saving') => void,
  setProgress: (progress: ProductImageProgress) => void
): Promise<ProductImage> {
  const key = imageSignature(image);
  if (cached?.key === key) return cached.receipt;
  setPhase('checking');
  setProgress({ stage: 'checking', processed: 0, total: image.size });
  const receipt = await dependencies.uploadImage.execute(request, image, undefined, (progress) => {
    setPhase(progress.stage);
    setProgress(progress);
  });
  cache(Object.freeze({ key, receipt }));
  return receipt;
}
