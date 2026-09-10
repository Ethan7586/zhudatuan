import type { StorefrontMemberCustomField, StorefrontMemberCustomProfileUpdate, StorefrontMemberFieldType, StorefrontMemberProfileConfig, StorefrontMemberTagColor } from '@shop/contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { safeQueryError } from '../../shared/api/QueryState';
import { saveStorefrontMemberConfig, saveStorefrontMemberCustomProfile } from './StorefrontMemberCommand';
import { readStorefrontMemberConfig, readStorefrontMemberCustomProfile, storefrontMemberConfigKey, storefrontMemberCustomKey } from './StorefrontMemberQuery';

const TYPES: readonly [StorefrontMemberFieldType, string][] = [
  ['text', '文本'],
  ['number', '数字'],
  ['date', '日期'],
  ['select', '单选'],
  ['multiselect', '多选'],
  ['switch', '开关'],
  ['remark', '备注'],
];
const COLORS: readonly [StorefrontMemberTagColor, string][] = [
  ['blue', '蓝色'],
  ['purple', '紫色'],
  ['green', '绿色'],
  ['orange', '橙色'],
  ['pink', '粉色'],
  ['gray', '灰色'],
];

export function StorefrontMemberCustomProfile({ membershipId }: Readonly<{ membershipId: string }>) {
  const context = useConsoleContext();
  const client = useQueryClient();
  const configKey = storefrontMemberConfigKey(context);
  const profileKey = storefrontMemberCustomKey(context, membershipId);
  const configQuery = useQuery({ queryKey: configKey, queryFn: ({ signal }) => readStorefrontMemberConfig(context, signal) });
  const profileQuery = useQuery({ queryKey: profileKey, queryFn: ({ signal }) => readStorefrontMemberCustomProfile(context, membershipId, signal) });
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<StorefrontMemberProfileConfig | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [values, setValues] = useState<Readonly<Record<string, unknown>>>({});
  const configSave = useMutation({
    mutationFn: (draft: StorefrontMemberProfileConfig) => saveStorefrontMemberConfig(context, draft),
    onSuccess: (saved) => {
      client.setQueryData(configKey, saved);
      setConfigOpen(false);
    },
  });
  const profileSave = useMutation({ mutationFn: (draft: StorefrontMemberCustomProfileUpdate) => saveStorefrontMemberCustomProfile(context, membershipId, draft), onSuccess: (saved) => client.setQueryData(profileKey, saved) });
  useEffect(() => {
    if (configQuery.data) setConfig(copyConfig(configQuery.data));
  }, [configQuery.data]);
  useEffect(() => {
    if (!profileQuery.data) return;
    setTags([...profileQuery.data.custom_tag_ids]);
    setValues(Object.fromEntries(profileQuery.data.custom_field_values.map(({ field_id, value }) => [field_id, value])));
  }, [profileQuery.data, membershipId]);
  const error = safeQueryError(configQuery.error) ?? safeQueryError(profileQuery.error);
  if (error !== undefined)
    return (
      <section className="storefrontmembercustomstate" role="alert">
        <strong>自定义档案暂不可用</strong>
        <p>{error}</p>
        <button type="button" onClick={() => void Promise.all([configQuery.refetch(), profileQuery.refetch()])}>
          重新加载
        </button>
      </section>
    );
  if (!config || !profileQuery.data)
    return (
      <section className="storefrontmembercustomstate" aria-live="polite">
        <strong>正在读取自定义档案…</strong>
      </section>
    );
  const enabledTags = config.tags.filter(({ enabled }) => enabled);
  const fields = config.fields.filter(({ enabled }) => enabled);
  const save = () => profileSave.mutate({ custom_tag_ids: tags, custom_field_values: fields.map((field) => ({ field_id: field.id, value: normalize(field, values[field.id]) })) });
  return (
    <>
      <section className="storefrontmemberdetailsection storefrontmembersystemtags">
        <header>
          <h3>系统标签</h3>
          <span>系统自动计算 · 只读</span>
        </header>
        <div className="storefrontmembertagcloud" data-kind="system">
          {profileQuery.data.system_tags.length === 0 ? <p>暂无系统标签</p> : profileQuery.data.system_tags.map((tag) => <span key={tag.code}>{tag.name}</span>)}
        </div>
      </section>
      <section className="storefrontmemberdetailsection">
        <header>
          <h3>自定义标签</h3>
          <button type="button" onClick={() => setConfigOpen((open) => !open)}>
            {configOpen ? '收起配置' : '配置标签与字段'}
          </button>
        </header>
        {enabledTags.length === 0 ? (
          <div className="storefrontmemberemptyline">当前商城尚未配置自定义标签</div>
        ) : (
          <div className="storefrontmembertagchoices" aria-label="自定义标签">
            {enabledTags.map((tag) => (
              <label key={tag.id} data-color={tag.color}>
                <input type="checkbox" checked={tags.includes(tag.id)} onChange={() => setTags((current) => (current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id]))} />
                <span>{tag.name}</span>
              </label>
            ))}
          </div>
        )}
        {configOpen ? (
          <ConfigEditor
            draft={config}
            saving={configSave.isPending}
            onChange={setConfig}
            onCancel={() => {
              setConfig(copyConfig(configQuery.data!));
              setConfigOpen(false);
            }}
            onSave={() => configSave.mutate(config)}
          />
        ) : null}
        {configSave.error ? <SaveError error={configSave.error} /> : null}
      </section>
      <section className="storefrontmemberdetailsection">
        <header>
          <h3>自定义资料</h3>
          <span>{fields.length} 个启用字段</span>
        </header>
        {fields.length === 0 ? (
          <div className="storefrontmemberemptyline">当前商城尚未配置自定义字段</div>
        ) : (
          <div className="storefrontmembercustomfields">
            {fields.map((field) => (
              <FieldEditor key={field.id} field={field} value={values[field.id]} onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))} />
            ))}
          </div>
        )}
        <div className="storefrontmembercustomactions">
          <button type="button" disabled={profileSave.isPending} onClick={save}>
            {profileSave.isPending ? '正在保存…' : '保存会员资料'}
          </button>
          {profileSave.isSuccess ? <span role="status">已保存</span> : null}
        </div>
        {profileSave.error ? <SaveError error={profileSave.error} /> : null}
      </section>
    </>
  );
}

function ConfigEditor({ draft, saving, onChange, onCancel, onSave }: Readonly<{ draft: StorefrontMemberProfileConfig; saving: boolean; onChange: (v: StorefrontMemberProfileConfig) => void; onCancel: () => void; onSave: () => void }>) {
  return (
    <div className="storefrontmemberconfigeditor">
      <div className="storefrontmemberconfiggroup">
        <h4>标签定义</h4>
        {draft.tags.map((tag, index) => (
          <div className="storefrontmemberconfigrow" key={tag.id}>
            <input aria-label={`标签 ${index + 1} 名称`} value={tag.name} onChange={(e) => onChange({ ...draft, tags: replace(draft.tags, index, { ...tag, name: e.target.value }) })} />
            <select aria-label={`标签 ${index + 1} 颜色`} value={tag.color} onChange={(e) => onChange({ ...draft, tags: replace(draft.tags, index, { ...tag, color: e.target.value as StorefrontMemberTagColor }) })}>
              {COLORS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input aria-label={`标签 ${index + 1} 排序`} type="number" min="0" value={tag.sort_order} onChange={(e) => onChange({ ...draft, tags: replace(draft.tags, index, { ...tag, sort_order: Number(e.target.value) }) })} />
            <label>
              <input type="checkbox" checked={tag.enabled} onChange={(e) => onChange({ ...draft, tags: replace(draft.tags, index, { ...tag, enabled: e.target.checked }) })} />
              启用
            </label>
            <button type="button" onClick={() => onChange({ ...draft, tags: draft.tags.filter((_, i) => i !== index) })}>
              删除
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...draft, tags: [...draft.tags, { id: crypto.randomUUID(), name: `新标签 ${draft.tags.length + 1}`, color: 'blue', sort_order: draft.tags.length, enabled: true }] })}>
          添加标签
        </button>
      </div>
      <div className="storefrontmemberconfiggroup">
        <h4>字段定义</h4>
        {draft.fields.map((field, index) => (
          <div className="storefrontmemberconfigrow storefrontmemberfieldconfig" key={field.id}>
            <input aria-label={`字段 ${index + 1} 名称`} value={field.name} onChange={(e) => onChange({ ...draft, fields: replace(draft.fields, index, { ...field, name: e.target.value }) })} />
            <select
              aria-label={`字段 ${index + 1} 类型`}
              value={field.type}
              onChange={(e) => {
                const type = e.target.value as StorefrontMemberFieldType;
                onChange({ ...draft, fields: replace(draft.fields, index, { ...field, type, options: type === 'select' || type === 'multiselect' ? (field.options.length ? field.options : ['选项一']) : [] }) });
              }}
            >
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {field.type === 'select' || field.type === 'multiselect' ? (
              <input
                aria-label={`字段 ${index + 1} 选项`}
                value={field.options.join('，')}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    fields: replace(draft.fields, index, {
                      ...field,
                      options: e.target.value
                        .split(/[，,]/)
                        .map((v) => v.trim())
                        .filter(Boolean),
                    }),
                  })
                }
              />
            ) : null}
            <input aria-label={`字段 ${index + 1} 排序`} type="number" min="0" value={field.sort_order} onChange={(e) => onChange({ ...draft, fields: replace(draft.fields, index, { ...field, sort_order: Number(e.target.value) }) })} />
            <label>
              <input type="checkbox" checked={field.enabled} onChange={(e) => onChange({ ...draft, fields: replace(draft.fields, index, { ...field, enabled: e.target.checked }) })} />
              启用
            </label>
            <button type="button" onClick={() => onChange({ ...draft, fields: draft.fields.filter((_, i) => i !== index) })}>
              删除
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...draft, fields: [...draft.fields, { id: crypto.randomUUID(), name: `新字段 ${draft.fields.length + 1}`, type: 'text', options: [], sort_order: draft.fields.length, enabled: true }] })}
        >
          添加字段
        </button>
      </div>
      <div className="storefrontmembercustomactions">
        <button type="button" disabled={saving} onClick={onSave}>
          {saving ? '正在保存配置…' : '保存配置'}
        </button>
        <button type="button" disabled={saving} onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}

function FieldEditor({ field, value, onChange }: Readonly<{ field: StorefrontMemberCustomField; value: unknown; onChange: (v: unknown) => void }>) {
  if (field.type === 'switch')
    return (
      <label className="storefrontmemberswitch">
        <span>{field.name}</span>
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
      </label>
    );
  if (field.type === 'remark')
    return (
      <label>
        <span>{field.name}</span>
        <textarea value={string(value)} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  if (field.type === 'select')
    return (
      <label>
        <span>{field.name}</span>
        <select value={string(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">请选择</option>
          {field.options.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
    );
  if (field.type === 'multiselect') {
    const selected = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
    return (
      <fieldset>
        <legend>{field.name}</legend>
        {field.options.map((v) => (
          <label key={v}>
            <input type="checkbox" checked={selected.includes(v)} onChange={() => onChange(selected.includes(v) ? selected.filter((i) => i !== v) : [...selected, v])} />
            {v}
          </label>
        ))}
      </fieldset>
    );
  }
  return (
    <label>
      <span>{field.name}</span>
      <input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={field.type === 'number' && typeof value === 'number' ? value : string(value)}
        onChange={(e) => onChange(field.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
      />
    </label>
  );
}
function SaveError({ error }: Readonly<{ error: Error }>) {
  return (
    <p className="storefrontmembersaveerror" role="alert">
      保存失败，修改内容仍保留。{safeQueryError(error)}
    </p>
  );
}
function normalize(field: StorefrontMemberCustomField, value: unknown): string | number | boolean | string[] | null {
  if (value === undefined || value === '') return null;
  if (field.type === 'switch') return value === true;
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : null;
  if (field.type === 'multiselect') return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  return typeof value === 'string' ? value : null;
}
function copyConfig(v: StorefrontMemberProfileConfig): StorefrontMemberProfileConfig {
  return { tags: v.tags.map((i) => ({ ...i })), fields: v.fields.map((i) => ({ ...i, options: [...i.options] })) };
}
function replace<T>(items: readonly T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}
function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
