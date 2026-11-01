-- Normalize existing generated stats once, so the indexed catalog type matches the
-- current read model. R2 pixels/metadata and historical race snapshots stay intact.
WITH RECURSIVE exact AS (
  SELECT id, min(20, max(1, speed * 40.0 / (speed + acceleration + stamina))) AS es,
    min(20, max(1, acceleration * 40.0 / (speed + acceleration + stamina))) AS ea,
    min(20, max(1, stamina * 40.0 / (speed + acceleration + stamina))) AS et
  FROM characters WHERE generated = 1 AND speed > 0 AND acceleration > 0 AND stamina > 0
), fitted(id, es, ea, et, s, a, t, direction) AS (
  SELECT id, es, ea, et, round(es), round(ea), round(et),
    CASE WHEN round(es) + round(ea) + round(et) < 40 THEN 1 ELSE -1 END FROM exact
  UNION ALL
  -- Stable ties prefer speed, then acceleration, then stamina.
  SELECT id, es, ea, et,
    s + CASE WHEN (
      CASE WHEN (direction = 1 AND s < 20) OR (direction = -1 AND s > 1) THEN direction * (es - s) ELSE -1000 END >=
      CASE WHEN (direction = 1 AND a < 20) OR (direction = -1 AND a > 1) THEN direction * (ea - a) ELSE -1000 END
      AND
      CASE WHEN (direction = 1 AND s < 20) OR (direction = -1 AND s > 1) THEN direction * (es - s) ELSE -1000 END >=
      CASE WHEN (direction = 1 AND t < 20) OR (direction = -1 AND t > 1) THEN direction * (et - t) ELSE -1000 END)
      THEN direction ELSE 0 END,
    a + CASE WHEN (
      CASE WHEN (direction = 1 AND a < 20) OR (direction = -1 AND a > 1) THEN direction * (ea - a) ELSE -1000 END >
      CASE WHEN (direction = 1 AND s < 20) OR (direction = -1 AND s > 1) THEN direction * (es - s) ELSE -1000 END
      AND
      CASE WHEN (direction = 1 AND a < 20) OR (direction = -1 AND a > 1) THEN direction * (ea - a) ELSE -1000 END >=
      CASE WHEN (direction = 1 AND t < 20) OR (direction = -1 AND t > 1) THEN direction * (et - t) ELSE -1000 END)
      THEN direction ELSE 0 END,
    t + CASE WHEN (
      CASE WHEN (direction = 1 AND t < 20) OR (direction = -1 AND t > 1) THEN direction * (et - t) ELSE -1000 END >
      CASE WHEN (direction = 1 AND s < 20) OR (direction = -1 AND s > 1) THEN direction * (es - s) ELSE -1000 END
      AND
      CASE WHEN (direction = 1 AND t < 20) OR (direction = -1 AND t > 1) THEN direction * (et - t) ELSE -1000 END >
      CASE WHEN (direction = 1 AND a < 20) OR (direction = -1 AND a > 1) THEN direction * (ea - a) ELSE -1000 END)
      THEN direction ELSE 0 END, direction
  FROM fitted WHERE s + a + t != 40
)
UPDATE characters SET (speed, acceleration, stamina) =
  (SELECT s, a, t FROM fitted WHERE fitted.id = characters.id AND s + a + t = 40)
WHERE id IN (SELECT id FROM exact);

ALTER TABLE characters ADD COLUMN character_type TEXT NOT NULL DEFAULT '';
UPDATE characters SET character_type = CASE
  WHEN max(speed, acceleration, stamina) - min(speed, acceleration, stamina) <= 3 THEN 'バランス'
  WHEN speed >= acceleration AND speed >= stamina THEN 'スピード'
  WHEN acceleration >= stamina THEN 'ダッシュ' ELSE 'スタミナ' END;
CREATE INDEX characters_newest ON characters(created_at DESC, id DESC);
CREATE INDEX characters_type_newest ON characters(character_type, created_at DESC, id DESC);
