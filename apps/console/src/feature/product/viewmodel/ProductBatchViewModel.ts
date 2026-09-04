import { OP_CATALOG_LISTINGS_BATCH } from '@shop/contract/ids';
import { presentError } from '@shop/presentation';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { identityFor, type CommandIdentity } from '../../../shared/action/CommandIdentity';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import type { Listing, ProductBatch, ProductBatchAction } from '../model/Product';
import { isManagedListing } from '../model/ProductAction';
import { command } from './ProductActionViewModel';

interface BatchDraft {
  readonly action: ProductBatchAction;
  readonly listings: readonly Listing[];
}

interface PreviewInput extends BatchDraft {
  readonly identity: string;
}
interface ExecuteInput extends BatchDraft {
  readonly identity: string;
  readonly preview: ProductBatch;
}

export function useProductBatchViewModel(context: ConsoleContext, dependencies: ProductDependencies, requestStepup: () => void, onCompleted: (receipt: ProductBatch) => void) {
  const [draft, setDraft] = useState<BatchDraft>();
  const [preview, setPreview] = useState<ProductBatch>();
  const [receipt, setReceipt] = useState<ProductBatch>();
  const [confirmed, setConfirmed] = useState(false);
  const executeidentity = useRef<CommandIdentity | undefined>(undefined);
  const allowed = canUseOperation(context, OP_CATALOG_LISTINGS_BATCH);
  const previewMutation = useMutation({
    mutationFn: (input: PreviewInput) => dependencies.previewBatch.execute(command(context, input.identity), input.listings, input.action),
    onSuccess: (value) => {
      setPreview(value);
      setReceipt(undefined);
      setConfirmed(false);
    },
  });
  const executeMutation = useMutation({
    mutationFn: (input: ExecuteInput) => dependencies.executeBatch.execute(command(context, input.identity), input.listings, input.action, input.preview),
    onSuccess: (value) => {
      setReceipt(value);
      onCompleted(value);
    },
  });
  const executeKey = identityFor(executeidentity, preview?.previewHash ?? 'closed', dependencies.createIdentity);
  const busy = previewMutation.isPending || executeMutation.isPending;
  const failure = previewMutation.error ?? executeMutation.error;

  const startPreview = (value: BatchDraft) => {
    setDraft(value);
    setPreview(undefined);
    setReceipt(undefined);
    setConfirmed(false);
    executeidentity.current = undefined;
    previewMutation.reset();
    executeMutation.reset();
    previewMutation.mutate({ ...value, identity: dependencies.createIdentity() });
  };
  const retry = () => {
    if (!draft || !receipt || busy) return;
    const failed = new Map(receipt.items.filter(({ state }) => state === 'failed').map((item) => [item.id, item]));
    const listings = draft.listings.flatMap((listing) => {
      const item = failed.get(listing.id);
      if (item === undefined) return [];
      return [item.version !== null && isManagedListing(listing) ? Object.freeze({ ...listing, version: item.version }) : listing];
    });
    if (listings.length > 0) startPreview(Object.freeze({ action: draft.action, listings: Object.freeze(listings) }));
  };
  return Object.freeze({
    open: draft !== undefined,
    draft,
    preview,
    receipt,
    confirmed,
    assurance: context.session.assurance.level,
    allowed,
    permissionReason: allowed ? undefined : '当前账号没有批量上架或下架商品的权限。',
    busy,
    executeFailed: executeMutation.error !== null,
    ...(failure === null ? {} : { error: presentError(failure).message }),
    actions: Object.freeze({
      open: (published: boolean, listings: readonly Listing[]) => {
        if (!allowed || busy || listings.length === 0) return;
        startPreview(Object.freeze({ action: published ? 'publish' : 'unpublish', listings: Object.freeze([...listings]) }));
      },
      close: () => {
        if (!busy) {
          setDraft(undefined);
          setPreview(undefined);
          setReceipt(undefined);
          setConfirmed(false);
          previewMutation.reset();
          executeMutation.reset();
        }
      },
      confirmed: setConfirmed,
      preview: () => {
        if (draft && !busy) startPreview(draft);
      },
      execute: () => {
        if (!draft || !preview || preview.phase !== 'preview' || preview.count < 1 || !confirmed || busy) return;
        if (context.session.assurance.level < 2) {
          requestStepup();
          return;
        }
        executeMutation.mutate({ ...draft, preview, identity: executeKey });
      },
      retry,
      stepup: requestStepup,
    }),
  });
}

export type ProductBatchViewModel = ReturnType<typeof useProductBatchViewModel>;
