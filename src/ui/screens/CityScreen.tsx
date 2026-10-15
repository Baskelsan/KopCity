import { useState } from 'preact/hooks';
import balance from '../../data/balance.json';
import {
  accessCap,
  barRates,
  BUILDINGS,
  canBuild,
  canExtendStadium,
  canUpgrade,
  demolitionRefund,
  districtSpec,
  findSlot,
  satisfactionTarget,
  shopWeeklyRevenue,
  SLOT_BUILDINGS,
  stadiumCapacity,
  supporters,
  weeklyUpkeep,
  withBuilding,
  type BuildCheck,
} from '../../core/city';
import { attendanceFor, matchAttraction } from '../../core/economy';
import type { Action } from '../../core/game';
import { myDivision, opponentOf } from '../../core/league';
import { MY_TEAM_ID, type BuildingType, type City, type District, type DivisionId, type GameState } from '../../core/state';
import { formatEuros, formatInteger } from '../formatters';
import { format, texts } from '../i18n';
import { Sheet } from '../Sheet';

const T = texts.city;
const E = T.effects;

/** Affluence attendue au prochain match à domicile (attrait de base hors saison). */
function expectedAttendance(state: GameState): number {
  const next = myDivision(state.league)
    .fixtures.filter((f) => f.home === MY_TEAM_ID && !f.result && f.week >= state.time.week)
    .sort((a, b) => a.week - b.week)[0];
  const attraction =
    state.phase === 'season' && next ? matchAttraction(state, opponentOf(next)) : balance.attraction.base;
  return attendanceFor(state.city, attraction).attendance;
}

/** Recette d'un bar par match à domicile, avec l'affluence attendue. */
function barRevenue(state: GameState, slotId: string): number {
  const rate = barRates(state.city).find((r) => r.slotId === slotId)?.perSpectator ?? 0;
  return Math.round(rate * expectedAttendance(state));
}

type Selection = { kind: 'slot'; slotId: string } | { kind: 'stadium' } | null;

interface CityScreenProps {
  state: GameState;
  dispatch: (action: Action) => void;
}

export function CityScreen({ state, dispatch }: CityScreenProps) {
  const [selection, setSelection] = useState<Selection>(null);
  const { city } = state;
  const close = () => setSelection(null);
  const act = (action: Action) => {
    dispatch(action);
    close();
  };

  return (
    <div class="screen city">
      <dl class="card summary wide-summary">
        <Row label={T.population} value={formatInteger(city.population)} />
        <Row label={T.supporters} value={formatInteger(supporters(city))} />
        <Row label={T.capacity} value={formatInteger(stadiumCapacity(city))} />
        <Row label={T.accessCap} value={formatInteger(accessCap(city))} />
        <Row
          label={T.satisfaction}
          value={format(T.satisfactionValue, { current: city.residentSatisfaction, target: satisfactionTarget(city) })}
        />
        <Row label={T.shopRevenue} value={format(T.perWeek, { amount: formatEuros(Math.round(shopWeeklyRevenue(city))) })} />
        <Row
          label={T.barsRevenue}
          value={format(T.perHomeMatch, {
            amount: formatEuros(barRates(city).reduce((sum, b) => sum + barRevenue(state, b.slotId), 0)),
          })}
        />
        <Row label={T.upkeep} value={format(T.perWeek, { amount: formatEuros(weeklyUpkeep(city)) })} />
        <Row
          label={T.constructions}
          value={format(T.constructionsValue, { count: city.constructions.length, max: balance.city.maxConstructions })}
        />
      </dl>

      <button type="button" class="card stadium-card" onClick={() => setSelection({ kind: 'stadium' })}>
        <strong>{T.stadium}</strong>
        <span class="muted">
          {format(T.stadiumLevel, {
            level: city.stadiumLevel,
            max: BUILDINGS.stadium.maxLevel,
            seats: formatInteger(stadiumCapacity(city)),
          })}
        </span>
        {city.constructions.some((c) => c.type === 'stadium') && (
          <span class="tag">
            {format(T.underConstruction, { weeks: city.constructions.find((c) => c.type === 'stadium')!.weeksLeft })}
          </span>
        )}
      </button>

      <div class="district-strip">
        {city.districts.map((d) => (
          <DistrictCard key={d.id} district={d} city={city} onSlot={(slotId) => setSelection({ kind: 'slot', slotId })} />
        ))}
      </div>

      {selection?.kind === 'stadium' && <StadiumSheet state={state} onClose={close} onAct={act} />}
      {selection?.kind === 'slot' && <SlotSheet state={state} slotId={selection.slotId} onClose={close} onAct={act} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function unlockText(district: District): string {
  const { population, division } = districtSpec(district.id).unlock;
  const parts: string[] = [];
  if (division) parts.push(format(T.unlockDivision, { division: texts.divisions[division as DivisionId] }));
  if (population) parts.push(format(T.unlockPopulation, { population: formatInteger(population) }));
  return format(T.locked, { condition: parts.join(T.unlockJoin) });
}

function DistrictCard({ district, city, onSlot }: { district: District; city: City; onSlot: (id: string) => void }) {
  return (
    <section class={`card district${district.unlocked ? '' : ' locked'}`}>
      <h2>{T.districts[district.id]}</h2>
      <p class="muted">{district.unlocked ? T.traits[district.id] : unlockText(district)}</p>
      <div class="slot-grid">
        {district.slots.map((slot) => {
          const construction = city.constructions.find((c) => c.slotId === slot.id);
          const type = slot.building?.type ?? construction?.type;
          return (
            <button
              key={slot.id}
              type="button"
              class={`slot${type ? ` b-${type}` : ''}${construction ? ' building-site' : ''}`}
              disabled={!district.unlocked}
              onClick={() => onSlot(slot.id)}
            >
              <span>{type ? texts.buildings[type] : T.emptySlot}</span>
              {slot.building && BUILDINGS[slot.building.type].maxLevel > 1 && (
                <small>{format(T.level, { level: slot.building.level })}</small>
              )}
              {construction && <small>{format(T.underConstruction, { weeks: construction.weeksLeft })}</small>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Ce que change le bâtiment : comparaison de la ville avant et après sa livraison. */
function EffectList({ before, after, slotId, type, level }: { before: City; after: City; slotId: string; type: BuildingType; level: number }) {
  const lines: string[] = [];
  const diff = (template: string, a: number, b: number, fmt = formatInteger) => {
    if (a !== b) lines.push(format(template, { before: fmt(a), after: fmt(b) }));
  };
  if (type === 'bar') {
    const rate = barRates(after).find((r) => r.slotId === slotId)?.perSpectator ?? 0;
    lines.push(format(E.barRate, { rate: formatCents(rate) }));
  }
  if (type === 'shop') lines.push(format(E.shopRevenue, { amount: formatEuros(shopWeeklyRevenue(after) - shopWeeklyRevenue(before)) }));
  if (type === 'academy') lines.push(format(E.academy, { level }));
  diff(E.population, before.population, after.population);
  diff(E.accessCap, accessCap(before), accessCap(after));
  diff(E.satisfaction, satisfactionTarget(before), satisfactionTarget(after));
  diff(E.upkeep, weeklyUpkeep(before), weeklyUpkeep(after), formatEuros);
  return (
    <ul class="effects">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

const cents = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
const formatCents = (value: number) => cents.format(value);

function Facts({ cost, weeks }: { cost: number; weeks: number }) {
  return (
    <p class="facts">
      <span>
        {T.cost} : <strong>{formatEuros(cost)}</strong>
      </span>
      <span>
        {T.duration} : <strong>{format(T.weeks, { weeks })}</strong>
      </span>
    </p>
  );
}

function CheckButton({ check, label, onClick }: { check: BuildCheck; label: string; onClick: () => void }) {
  return check.ok ? (
    <button type="button" class="button wide" onClick={onClick}>
      {label}
    </button>
  ) : (
    <p class="refusal">{T.refusals[check.reason]}</p>
  );
}

function StadiumSheet({ state, onClose, onAct }: { state: GameState; onClose: () => void; onAct: (a: Action) => void }) {
  const { city } = state;
  const spec = BUILDINGS.stadium;
  const construction = city.constructions.find((c) => c.type === 'stadium');
  const check = canExtendStadium(state);
  const after: City = { ...city, stadiumLevel: city.stadiumLevel + 1 };
  return (
    <Sheet title={T.stadium} onClose={onClose}>
      <p>
        {format(T.stadiumLevel, { level: city.stadiumLevel, max: spec.maxLevel, seats: formatInteger(stadiumCapacity(city)) })}
      </p>
      {construction ? (
        <p class="muted">{format(T.inProgress, { weeks: construction.weeksLeft })}</p>
      ) : (
        city.stadiumLevel < spec.maxLevel && (
          <>
            <h3>{T.extendStadium}</h3>
            <ul class="effects">
              <li>{format(E.capacity, { before: formatInteger(stadiumCapacity(city)), after: formatInteger(stadiumCapacity(after)) })}</li>
              <li>{format(E.satisfaction, { before: satisfactionTarget(city), after: satisfactionTarget(after) })}</li>
              <li>{format(E.upkeep, { before: formatEuros(weeklyUpkeep(city)), after: formatEuros(weeklyUpkeep(after)) })}</li>
            </ul>
            <Facts cost={spec.cost} weeks={spec.weeks} />
            <CheckButton
              check={check}
              label={format(T.launch, { cost: formatEuros(check.cost) })}
              onClick={() => onAct({ type: 'extendStadium' })}
            />
          </>
        )
      )}
      <button type="button" class="button secondary wide" onClick={onClose}>
        {T.close}
      </button>
    </Sheet>
  );
}

function SlotSheet({
  state,
  slotId,
  onClose,
  onAct,
}: {
  state: GameState;
  slotId: string;
  onClose: () => void;
  onAct: (a: Action) => void;
}) {
  const { city } = state;
  const found = findSlot(city, slotId);
  if (!found) return null;
  const building = found.slot.building;
  const construction = city.constructions.find((c) => c.slotId === slotId);
  const districtName = T.districts[found.district.id];

  if (construction && !building) {
    return (
      <Sheet title={texts.buildings[construction.type]} onClose={onClose}>
        <p class="muted">{districtName}</p>
        <p>{format(T.inProgress, { weeks: construction.weeksLeft })}</p>
        <button type="button" class="button secondary wide" onClick={onClose}>
          {T.close}
        </button>
      </Sheet>
    );
  }

  if (building) {
    const spec = BUILDINGS[building.type];
    const name = texts.buildings[building.type];
    const refund = demolitionRefund(building.type, building.level);
    const upgrade = canUpgrade(state, slotId);
    const canLevelUp = building.level < spec.maxLevel;
    const nextLevel = building.level + 1;
    return (
      <Sheet title={name} onClose={onClose}>
        <p class="muted">
          {districtName}
          {spec.maxLevel > 1 && ` · ${format(T.level, { level: building.level })}`}
        </p>
        {building.type === 'bar' && (
          <p>{format(T.buildingRevenue, { amount: format(T.perHomeMatch, { amount: formatEuros(barRevenue(state, slotId)) }) })}</p>
        )}
        {building.type === 'shop' && (
          <p>
            {format(T.buildingRevenue, {
              amount: format(T.perWeek, { amount: formatEuros(Math.round(shopWeeklyRevenue(city))) }),
            })}
          </p>
        )}
        {construction ? (
          <p>{format(T.inProgress, { weeks: construction.weeksLeft })}</p>
        ) : (
          canLevelUp && (
            <>
              <EffectList
                before={city}
                after={withBuilding(city, slotId, building.type, nextLevel)}
                slotId={slotId}
                type={building.type}
                level={nextLevel}
              />
              <Facts cost={spec.cost} weeks={spec.weeks} />
              <CheckButton
                check={upgrade}
                label={format(T.upgrade, { level: nextLevel, cost: formatEuros(upgrade.cost) })}
                onClick={() => onAct({ type: 'upgradeBuilding', slotId })}
              />
            </>
          )
        )}
        {!construction && (
          <button
            type="button"
            class="button secondary wide"
            onClick={() => {
              if (window.confirm(format(T.confirmDemolish, { name, refund: formatEuros(refund) }))) {
                onAct({ type: 'demolish', slotId });
              }
            }}
          >
            {format(T.demolish, { refund: formatEuros(refund) })}
          </button>
        )}
        <button type="button" class="button secondary wide" onClick={onClose}>
          {T.close}
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title={`${T.buildTitle} · ${districtName}`} onClose={onClose}>
      <div class="build-options">
        {SLOT_BUILDINGS.map((type) => {
          const spec = BUILDINGS[type];
          const check = canBuild(state, slotId, type);
          return (
            <section key={type} class={`build-option b-${type}`}>
              <h3>{texts.buildings[type]}</h3>
              <EffectList before={city} after={withBuilding(city, slotId, type, 1)} slotId={slotId} type={type} level={1} />
              <Facts cost={spec.cost} weeks={spec.weeks} />
              <CheckButton
                check={check}
                label={format(T.launch, { cost: formatEuros(check.cost) })}
                onClick={() => onAct({ type: 'build', slotId, building: type })}
              />
            </section>
          );
        })}
      </div>
      <button type="button" class="button secondary wide" onClick={onClose}>
        {T.close}
      </button>
    </Sheet>
  );
}
