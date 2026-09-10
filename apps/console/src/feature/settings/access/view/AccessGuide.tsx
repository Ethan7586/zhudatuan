import type { AccessTask } from '../viewmodel/AccessViewState';

const steps = Object.freeze([
  Object.freeze({ task: 'members' as const, eyebrow: '谁', title: '选择成员', detail: '找到需要授权的人' }),
  Object.freeze({ task: 'roles' as const, eyebrow: '做什么', title: '分配岗位角色', detail: '批量授予工作职责' }),
  Object.freeze({ task: 'scopes' as const, eyebrow: '在哪里', title: '限定项目范围', detail: '只管理指定商城或门店' }),
  Object.freeze({ task: null, eyebrow: '如何生效', title: '预览并安全提交', detail: '核对影响，验证后生效' }),
]);

export function AccessGuide({ task }: Readonly<{ task: AccessTask }>) {
  return (
    <section className="accessguide" aria-labelledby="accessguidetitle">
      <header>
        <span>授权关系</span>
        <div>
          <h2 id="accessguidetitle">谁，在什么地方，可以做什么</h2>
          <p>系统把成员、岗位角色和项目范围组合成最终权限。</p>
        </div>
      </header>
      <ol>
        {steps.map((step, index) => (
          <li key={step.eyebrow} aria-current={step.task === task ? 'step' : undefined}>
            <b>{index + 1}</b>
            <span>
              <small>{step.eyebrow}</small>
              <strong>{step.title}</strong>
              <em>{step.detail}</em>
            </span>
          </li>
        ))}
      </ol>
      <p className="accessguidenote">常规权限优先通过岗位角色统一配置；个人权限只处理少数临时或特殊情况。</p>
    </section>
  );
}
