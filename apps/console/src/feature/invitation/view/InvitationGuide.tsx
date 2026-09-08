export function InvitationGuide() {
  return (
    <section className="invitationguide" aria-labelledby="invitationGuideTitle">
      <header>
        <p>统一闭环</p>
        <h2 id="invitationGuideTitle">每一种邀请都从同一个入口完成</h2>
      </header>
      <ol>
        <li>
          <span>1</span>
          <div>
            <strong>创建邀请</strong>
            <small>选择注册新员工或确认现有成员</small>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>安全传递</strong>
            <small>一次性回执只在创建成功后展示</small>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>接收人验证</strong>
            <small>统一邀请页核验邀请码和本人身份</small>
          </div>
        </li>
        <li>
          <span>4</span>
          <div>
            <strong>注册或进入</strong>
            <small>服务端按固定范围创建身份或签发会话</small>
          </div>
        </li>
      </ol>
    </section>
  );
}
