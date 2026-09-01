import { useState, type KeyboardEvent } from 'react';
import { Badge } from './Badge';
import { Button, IconButton } from './Button';
import { Icon } from './Icon';
import { Glyph, Heading } from './VI11StoryFoundation';

const tabs = ['成員', '角色', '實體範圍', '審計'] as const;

export function ComponentSections() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('角色');

  function selectAdjacentTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    if (!buttons?.length) return;
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    const nextTab = tabs[nextIndex];
    if (nextTab === undefined) return;
    setTab(nextTab);
    buttons[nextIndex]?.focus();
  }

  return (
    <>
      <section className="v11section">
        <Heading eyebrow="07 · Button" title="Button 全狀態與密度" note="桌面 Compact 36、Default 40、Large 48；粗指標裝置自動提高至 44px。" />
        <div className="v11buttonmatrix">
          <div>
            <span>Default</span>
            <Button>
              <Icon size="small">
                <Glyph kind="plus" />
              </Icon>
              建立角色
            </Button>
            <Button isDisabled>不可操作</Button>
          </div>
          <div>
            <span>Primary</span>
            <Button tone="primary">
              <Icon size="small">
                <Glyph kind="shield" />
              </Icon>
              保存並預覽
            </Button>
            <Button tone="primary" isPending>
              提交中
            </Button>
          </div>
          <div>
            <span>Quiet</span>
            <Button tone="quiet">取消</Button>
            <IconButton label="刷新資料" tone="quiet">
              <Icon size="small">
                <Glyph kind="refresh" />
              </Icon>
            </IconButton>
          </div>
          <div>
            <span>Danger</span>
            <Button tone="danger">移除成員</Button>
            <IconButton label="搜尋" size="compact">
              <Icon size="small">
                <Glyph kind="search" />
              </Icon>
            </IconButton>
          </div>
        </div>
      </section>

      <section className="v11section v11twocol">
        <div>
          <Heading eyebrow="08 · Control" title="輸入與狀態" note="Hover 改邊框，Focus 使用 3px ring，Invalid 不只靠顏色。" />
          <div className="v11fields">
            <label className="swfield">
              <span className="swfieldlabel">角色名稱</span>
              <input aria-describedby="role-name-hint" className="swcontrol" defaultValue="集團運營" />
              <small className="swfieldhint" id="role-name-hint">
                2–24 個字符，保存後寫入審計。
              </small>
            </label>
            <label className="swfield">
              <span className="swfieldlabel">錯誤示例</span>
              <input aria-describedby="role-name-error" aria-invalid="true" className="swcontrol" defaultValue="Owner" />
              <small className="swfielderrormessage" id="role-name-error">
                Owner 角色不可覆蓋。
              </small>
            </label>
          </div>
        </div>
        <div>
          <Heading eyebrow="09 · Badge" title="Badge 與身份" note="Badge 是狀態摘要，不作主要操作入口。" />
          <div className="v11badges">
            <Badge>neutral</Badge>
            <Badge tone="info">info</Badge>
            <Badge tone="success">active</Badge>
            <Badge tone="warning">step-up</Badge>
            <Badge tone="danger">denied</Badge>
            <span className="swavatar">本</span>
          </div>
        </div>
      </section>

      <section className="v11section">
        <Heading eyebrow="10 · Navigation & Data" title="Tabs、表格與選中態" note="表頭 12px、資料 14px；選中使用 tint，不提高陰影。" />
        <div className="swtabs" role="tablist" aria-label="權限中心分頁">
          {tabs.map((item, index) => (
            <button
              aria-controls="vi-permission-tabpanel"
              aria-selected={tab === item}
              id={`vi-permission-tab-${index}`}
              key={item}
              onClick={() => setTab(item)}
              onKeyDown={(event) => selectAdjacentTab(event, index)}
              role="tab"
              tabIndex={tab === item ? 0 : -1}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <div aria-labelledby={`vi-permission-tab-${tabs.indexOf(tab)}`} className="swtable" id="vi-permission-tabpanel" role="tabpanel" tabIndex={0}>
          <table>
            <caption className="sr-only">權限關係示例</caption>
            <thead>
              <tr>
                <th>成員關係</th>
                <th>角色</th>
                <th>實體範圍</th>
                <th>狀態</th>
                <th>版本</th>
              </tr>
            </thead>
            <tbody>
              <tr aria-selected="true">
                <td>membership:group-operator</td>
                <td>集團運營</td>
                <td>集團 / 商城 / 門店</td>
                <td>
                  <Badge tone="success">active</Badge>
                </td>
                <td>v12</td>
              </tr>
              <tr>
                <td>membership:mall-finance</td>
                <td>商城財務</td>
                <td>商城 B</td>
                <td>
                  <Badge tone="warning">step-up</Badge>
                </td>
                <td>v7</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="v11section">
        <Heading eyebrow="11 · Feedback" title="反饋、Loading 與失效邊界" note="圖標、標題、原因、下一步四件套；禁止只用顏色。" />
        <div className="v11feedback">
          <div className="swnotice">
            <Icon tone="brand" size="small">
              <Glyph kind="shield" />
            </Icon>
            <div>
              <strong>權限預覽已就緒</strong>
              <p>確認變更後再執行 Step-up 與 expectedVersion 校驗。</p>
            </div>
          </div>
          <div className="swnotice" data-tone="warning">
            <Icon tone="warning" size="small">
              <Glyph kind="layers" />
            </Icon>
            <div>
              <strong>資料可能已過期</strong>
              <p>保留最近一次成功讀取，刷新後才允許提交。</p>
            </div>
          </div>
          <div className="v11loading">
            <i aria-label="載入中" className="swspinner" role="status" />
            <span aria-hidden="true" className="swskeleton" />
            <span aria-hidden="true" className="swskeleton" />
          </div>
        </div>
      </section>
    </>
  );
}
