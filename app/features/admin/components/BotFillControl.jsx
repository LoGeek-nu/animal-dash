import { Button } from "../../../components/ui/atoms/Button.jsx";

export function BotFillControl({ disabled, onFill }) {
  return (
    <Button variant="unstyled" className="fill-bots-button" disabled={disabled} onClick={onFill}>
      <span>BOT</span><div><strong>空きレーンをBOTで補充</strong><small>自動操作のキャラクターを追加します</small></div><i>→</i>
    </Button>
  );
}
