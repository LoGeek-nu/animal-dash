export function SearchField({ value, onChange, placeholder, label = "キャラクターを検索" }) {
  return (
    <label className="search-box">
      <span aria-hidden="true">⌕</span>
      <span className="sr-only">{label}</span>
      <input value={value} onChange={onChange} placeholder={placeholder} />
    </label>
  );
}
