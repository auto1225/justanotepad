/** mm ↔ px 환산 (96dpi 기준) — 눈금자·용지 계산 공용 */
const MM_PER_IN = 25.4
const PX_PER_IN = 96

export const mmToPx = (mm: number) => (mm * PX_PER_IN) / MM_PER_IN
export const pxToMm = (px: number) => (px * MM_PER_IN) / PX_PER_IN
