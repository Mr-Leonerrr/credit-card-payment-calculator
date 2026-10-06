export function SectionHeading({ title, icon: Icon }) {
  return (
    <div className="section-heading">
      <h2>
        <Icon size={19} />
        {title}
      </h2>
    </div>
  );
}
