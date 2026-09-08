export function ChoiceIntro({ step, title, description, titleId, descriptionId }: Readonly<{ step: 1 | 2; title: string; description: string; titleId?: string; descriptionId?: string }>) {
  return (
    <header className="authchoiceintro">
      <span className="authchoicebadge">第 {step} 步</span>
      <div className="authchoicecopy">
        <h3 id={titleId}>{title}</h3>
        <p id={descriptionId}>{description}</p>
      </div>
    </header>
  );
}
