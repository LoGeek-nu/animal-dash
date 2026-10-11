export function StaminaMeter({ value, className = "stamina-meter" }) {
  return <div className={className}><span>BOOST</span><i><b style={{ width: `${value}%` }} /></i></div>;
}
