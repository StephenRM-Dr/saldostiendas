export interface ConceptOption {
  label: string;
  type: 'ingreso' | 'gasto';
}

export const CONCEPTS: ConceptOption[] = [
  { label: 'Ingreso Ventas Diarias', type: 'ingreso' },
  { label: 'Cambio Zelle', type: 'gasto' },
  { label: 'Ajuste de Caja', type: 'ingreso' },
  { label: 'Gasto', type: 'gasto' },
];

export const OTRO_LABEL = 'Otro';
