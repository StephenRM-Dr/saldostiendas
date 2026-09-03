import { ImageResponse } from 'next/og';
import { formatMoney } from './money';
import { signedAmount } from './movementDisplay';
import type { Movement } from './movements';
import type { Balance } from './balance';

const IMAGE_WIDTH = 800;
const IMAGE_WIDTH_WITH_COP = 1000;
const TITLE_HEIGHT = 90;
const ROW_HEIGHT = 45;
const ROW_VERTICAL_PADDING = 16;
const CONCEPT_LINE_HEIGHT = 26;
const CHARS_PER_CONCEPT_LINE = 33;
const MAX_CONCEPT_LINES = 2;
const OBSERVACION_LINE_HEIGHT = 18;
const CHARS_PER_OBSERVACION_LINE = 50;
const MAX_OBSERVACION_LINES = 3;
const VERTICAL_PADDING = 40;
const YELLOW = '#fde047';
const YELLOW_LIGHT = '#fef9c3';
const WHITE = '#ffffff';
const RED = '#dc2626';
const GREEN = '#16a34a';
const DEFAULT_TEXT = '#111827';
const OBSERVACION_TEXT = '#6b7280';

// Satori (next/og) renders each row at a fixed height, so text that overflows
// gets silently clipped instead of pushing the row taller. We estimate how
// many lines the concept (can be a long free-typed "Otro" value) and the
// observación will wrap to, and truncate anything beyond the line caps so
// height and rendered text always agree.
function truncateToLines(text: string, charsPerLine: number, maxLines: number): string {
  const maxChars = charsPerLine * maxLines;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

function truncateObservacion(text: string): string {
  return truncateToLines(text, CHARS_PER_OBSERVACION_LINE, MAX_OBSERVACION_LINES);
}

function truncateConcept(text: string): string {
  return truncateToLines(text, CHARS_PER_CONCEPT_LINE, MAX_CONCEPT_LINES);
}

function movementRowHeight(concept: string, observacion: string): number {
  const conceptLines = Math.max(1, Math.ceil(truncateConcept(concept).length / CHARS_PER_CONCEPT_LINE));
  const truncatedObservacion = truncateObservacion(observacion);
  const observacionLines = truncatedObservacion
    ? Math.ceil(truncatedObservacion.length / CHARS_PER_OBSERVACION_LINE)
    : 0;
  return ROW_VERTICAL_PADDING + conceptLines * CONCEPT_LINE_HEIGHT + observacionLines * OBSERVACION_LINE_HEIGHT;
}

export function calculateImageHeight(movements: { concept: string; observacion: string }[]): number {
  const fixedRows = 3; // header + saldo inicial + saldo final
  const dataRowsHeight =
    movements.length === 0
      ? ROW_HEIGHT
      : movements.reduce((sum, m) => sum + movementRowHeight(m.concept, m.observacion), 0);
  return TITLE_HEIGHT + VERTICAL_PADDING + fixedRows * ROW_HEIGHT + dataRowsHeight;
}

function formatDateDMY(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function Row({
  concept,
  observacion,
  usd,
  ves,
  cop,
  background,
  bold,
  amountColor,
}: {
  concept: string;
  observacion?: string;
  usd: string;
  ves: string;
  cop?: string;
  background: string;
  bold?: boolean;
  amountColor?: string;
}) {
  const amountFontWeight = amountColor || bold ? 700 : 400;
  const isMovementRow = observacion !== undefined;
  const displayConcept = isMovementRow ? truncateConcept(concept) : concept;
  const truncatedObservacion = observacion ? truncateObservacion(observacion) : undefined;
  const rowHeight = isMovementRow ? movementRowHeight(concept, observacion) : ROW_HEIGHT;

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: `${rowHeight}px`,
        backgroundColor: background,
        fontWeight: bold ? 700 : 400,
        fontSize: 20,
        borderBottom: '1px solid #d1d5db',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '400px',
          padding: '0 12px',
        }}
      >
        <div style={{ display: 'flex' }}>{displayConcept}</div>
        {truncatedObservacion && (
          <div style={{ display: 'flex', fontSize: 14, fontWeight: 400, color: OBSERVACION_TEXT }}>
            {truncatedObservacion}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          width: '200px',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 12px',
          color: amountColor ?? DEFAULT_TEXT,
          fontWeight: amountFontWeight,
        }}
      >
        {usd}
      </div>
      <div
        style={{
          display: 'flex',
          width: '200px',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 12px',
          color: amountColor ?? DEFAULT_TEXT,
          fontWeight: amountFontWeight,
        }}
      >
        {ves}
      </div>
      {cop !== undefined && (
        <div
          style={{
            display: 'flex',
            width: '200px',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 12px',
            color: amountColor ?? DEFAULT_TEXT,
            fontWeight: amountFontWeight,
          }}
        >
          {cop}
        </div>
      )}
    </div>
  );
}

export function buildReportImageElement(
  storeName: string,
  date: string,
  ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance },
  label: string = 'Cierre',
  showCop: boolean = false
) {
  const { movements, saldoInicial, saldoFinal } = ledger;
  const cop = (cents: number) => (showCop ? formatMoney(cents) : undefined);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: `${showCop ? IMAGE_WIDTH_WITH_COP : IMAGE_WIDTH}px`,
        backgroundColor: WHITE,
        fontFamily: 'sans-serif',
        color: '#111827',
      }}
    >
      <div
        style={{
          display: 'flex',
          height: `${TITLE_HEIGHT}px`,
          alignItems: 'center',
          padding: '0 12px',
          fontSize: 28,
          fontWeight: 700,
        }}
      >
        {`${storeName} — ${label} ${formatDateDMY(date)}`}
      </div>
      <Row
        concept="Concepto"
        usd="Dólares"
        ves="Bolívares"
        cop={showCop ? 'Pesos COP' : undefined}
        background={YELLOW}
        bold
      />
      <Row
        concept="Saldo al inicio del día"
        usd={formatMoney(saldoInicial.usdCents)}
        ves={formatMoney(saldoInicial.vesCents)}
        cop={cop(saldoInicial.copCents)}
        background={YELLOW_LIGHT}
        bold
      />
      {movements.length === 0 ? (
        <Row concept="Sin movimientos hoy." usd="" ves="" cop={showCop ? '' : undefined} background={WHITE} />
      ) : (
        movements.map((m) => (
          <Row
            key={m.id}
            concept={m.concept}
            observacion={m.observacion}
            usd={signedAmount(m, 'amount_usd')}
            ves={signedAmount(m, 'amount_ves')}
            cop={showCop ? signedAmount(m, 'amount_cop') : undefined}
            background={WHITE}
            amountColor={m.type === 'gasto' ? RED : GREEN}
          />
        ))
      )}
      <Row
        concept="Saldo al Final del día"
        usd={formatMoney(saldoFinal.usdCents)}
        ves={formatMoney(saldoFinal.vesCents)}
        cop={cop(saldoFinal.copCents)}
        background={YELLOW}
        bold
      />
    </div>
  );
}

export async function generateReportImageBuffer(
  storeName: string,
  date: string,
  ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance },
  label: string = 'Cierre',
  showCop: boolean = false
): Promise<Buffer> {
  const height = calculateImageHeight(ledger.movements);
  const imageResponse = new ImageResponse(
    buildReportImageElement(storeName, date, ledger, label, showCop),
    { width: showCop ? IMAGE_WIDTH_WITH_COP : IMAGE_WIDTH, height }
  );
  const arrayBuffer = await imageResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
