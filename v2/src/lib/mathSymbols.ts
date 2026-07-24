/**
 * 전 이공계 수식 기호·템플릿 라이브러리.
 * 각 항목: { tex: 삽입할 LaTeX, tip: 설명 }. 팔레트는 tex 를 KaTeX 로 렌더해 보여준다.
 * 커서 자리표시자 `□` 는 삽입 후 첫 인수 위치로 이동하는 데 쓰인다(에디터가 처리).
 */
export interface Sym { tex: string; tip: string }
export interface SymGroup { key: string; label: string; items: Sym[] }

export const MATH_SYMBOL_GROUPS: SymGroup[] = [
  {
    key: 'greek', label: '그리스', items: [
      { tex: '\\alpha', tip: 'alpha' }, { tex: '\\beta', tip: 'beta' }, { tex: '\\gamma', tip: 'gamma' }, { tex: '\\delta', tip: 'delta' },
      { tex: '\\epsilon', tip: 'epsilon' }, { tex: '\\varepsilon', tip: 'varepsilon' }, { tex: '\\zeta', tip: 'zeta' }, { tex: '\\eta', tip: 'eta' },
      { tex: '\\theta', tip: 'theta' }, { tex: '\\vartheta', tip: 'vartheta' }, { tex: '\\iota', tip: 'iota' }, { tex: '\\kappa', tip: 'kappa' },
      { tex: '\\lambda', tip: 'lambda' }, { tex: '\\mu', tip: 'mu' }, { tex: '\\nu', tip: 'nu' }, { tex: '\\xi', tip: 'xi' },
      { tex: '\\pi', tip: 'pi' }, { tex: '\\varpi', tip: 'varpi' }, { tex: '\\rho', tip: 'rho' }, { tex: '\\sigma', tip: 'sigma' },
      { tex: '\\tau', tip: 'tau' }, { tex: '\\upsilon', tip: 'upsilon' }, { tex: '\\phi', tip: 'phi' }, { tex: '\\varphi', tip: 'varphi' },
      { tex: '\\chi', tip: 'chi' }, { tex: '\\psi', tip: 'psi' }, { tex: '\\omega', tip: 'omega' },
      { tex: '\\Gamma', tip: 'Gamma' }, { tex: '\\Delta', tip: 'Delta' }, { tex: '\\Theta', tip: 'Theta' }, { tex: '\\Lambda', tip: 'Lambda' },
      { tex: '\\Xi', tip: 'Xi' }, { tex: '\\Pi', tip: 'Pi' }, { tex: '\\Sigma', tip: 'Sigma' }, { tex: '\\Upsilon', tip: 'Upsilon' },
      { tex: '\\Phi', tip: 'Phi' }, { tex: '\\Psi', tip: 'Psi' }, { tex: '\\Omega', tip: 'Omega' }, { tex: '\\nabla', tip: 'nabla' },
    ],
  },
  {
    key: 'op', label: '연산·관계', items: [
      { tex: '\\pm', tip: 'plus-minus' }, { tex: '\\mp', tip: 'minus-plus' }, { tex: '\\times', tip: 'times' }, { tex: '\\div', tip: 'divide' },
      { tex: '\\cdot', tip: 'dot' }, { tex: '\\ast', tip: 'ast' }, { tex: '\\star', tip: 'star' }, { tex: '\\circ', tip: 'circ' },
      { tex: '\\oplus', tip: 'oplus' }, { tex: '\\ominus', tip: 'ominus' }, { tex: '\\otimes', tip: 'otimes' }, { tex: '\\odot', tip: 'odot' },
      { tex: '\\le', tip: 'leq' }, { tex: '\\ge', tip: 'geq' }, { tex: '\\ne', tip: 'neq' }, { tex: '\\approx', tip: 'approx' },
      { tex: '\\equiv', tip: 'equiv' }, { tex: '\\cong', tip: 'cong' }, { tex: '\\sim', tip: 'sim' }, { tex: '\\simeq', tip: 'simeq' },
      { tex: '\\propto', tip: 'propto' }, { tex: '\\ll', tip: 'much-less' }, { tex: '\\gg', tip: 'much-greater' }, { tex: '\\doteq', tip: 'doteq' },
      { tex: '\\prec', tip: 'prec' }, { tex: '\\succ', tip: 'succ' }, { tex: '\\parallel', tip: 'parallel' }, { tex: '\\perp', tip: 'perp' },
      { tex: '\\angle', tip: 'angle' }, { tex: '\\measuredangle', tip: 'measured angle' }, { tex: '\\triangle', tip: 'triangle' }, { tex: '\\square', tip: 'square' },
    ],
  },
  {
    key: 'arrow', label: '화살표', items: [
      { tex: '\\to', tip: 'to' }, { tex: '\\gets', tip: 'gets' }, { tex: '\\leftrightarrow', tip: 'leftrightarrow' }, { tex: '\\mapsto', tip: 'mapsto' },
      { tex: '\\Rightarrow', tip: 'Rightarrow' }, { tex: '\\Leftarrow', tip: 'Leftarrow' }, { tex: '\\Leftrightarrow', tip: 'iff' }, { tex: '\\longrightarrow', tip: 'longrightarrow' },
      { tex: '\\uparrow', tip: 'uparrow' }, { tex: '\\downarrow', tip: 'downarrow' }, { tex: '\\updownarrow', tip: 'updownarrow' }, { tex: '\\nearrow', tip: 'nearrow' },
      { tex: '\\searrow', tip: 'searrow' }, { tex: '\\rightleftharpoons', tip: 'equilibrium' }, { tex: '\\hookrightarrow', tip: 'hookrightarrow' }, { tex: '\\twoheadrightarrow', tip: 'onto' },
    ],
  },
  {
    key: 'bigop', label: '큰 연산자', items: [
      { tex: '\\sum_{□}^{□}', tip: 'sum' }, { tex: '\\prod_{□}^{□}', tip: 'product' }, { tex: '\\coprod_{□}^{□}', tip: 'coproduct' },
      { tex: '\\int_{□}^{□} □\\,d□', tip: 'integral' }, { tex: '\\iint_{□} □\\,dA', tip: 'double integral' }, { tex: '\\iiint_{□} □\\,dV', tip: 'triple integral' },
      { tex: '\\oint_{□} □', tip: 'contour integral' }, { tex: '\\bigcup_{□}^{□}', tip: 'union' }, { tex: '\\bigcap_{□}^{□}', tip: 'intersection' },
      { tex: '\\bigoplus_{□}', tip: 'big oplus' }, { tex: '\\bigotimes_{□}', tip: 'big otimes' }, { tex: '\\lim_{□ \\to □}', tip: 'limit' },
    ],
  },
  {
    key: 'calc', label: '미적분', items: [
      { tex: '\\frac{d□}{d□}', tip: 'derivative' }, { tex: '\\frac{d^{2}□}{d□^{2}}', tip: 'second derivative' }, { tex: '\\frac{\\partial □}{\\partial □}', tip: 'partial' },
      { tex: '\\frac{\\partial^{2} □}{\\partial □^{2}}', tip: 'second partial' }, { tex: '\\nabla □', tip: 'grad' }, { tex: '\\nabla \\cdot □', tip: 'divergence' },
      { tex: '\\nabla \\times □', tip: 'curl' }, { tex: '\\nabla^{2} □', tip: 'laplacian' }, { tex: '\\partial', tip: 'partial' },
      { tex: '\\lim_{□ \\to \\infty}', tip: 'limit to inf' }, { tex: '\\infty', tip: 'infinity' }, { tex: 'dx', tip: 'dx' },
    ],
  },
  {
    key: 'setlogic', label: '집합·논리', items: [
      { tex: '\\forall', tip: 'for all' }, { tex: '\\exists', tip: 'exists' }, { tex: '\\nexists', tip: 'not exists' }, { tex: '\\in', tip: 'in' },
      { tex: '\\notin', tip: 'not in' }, { tex: '\\ni', tip: 'ni' }, { tex: '\\subset', tip: 'subset' }, { tex: '\\subseteq', tip: 'subseteq' },
      { tex: '\\supset', tip: 'supset' }, { tex: '\\supseteq', tip: 'supseteq' }, { tex: '\\cup', tip: 'union' }, { tex: '\\cap', tip: 'intersection' },
      { tex: '\\setminus', tip: 'setminus' }, { tex: '\\emptyset', tip: 'empty set' }, { tex: '\\varnothing', tip: 'varnothing' }, { tex: '\\land', tip: 'and' },
      { tex: '\\lor', tip: 'or' }, { tex: '\\lnot', tip: 'not' }, { tex: '\\implies', tip: 'implies' }, { tex: '\\iff', tip: 'iff' },
      { tex: '\\therefore', tip: 'therefore' }, { tex: '\\because', tip: 'because' }, { tex: '\\mathbb{R}', tip: 'reals' }, { tex: '\\mathbb{C}', tip: 'complex' },
      { tex: '\\mathbb{Z}', tip: 'integers' }, { tex: '\\mathbb{N}', tip: 'naturals' }, { tex: '\\mathbb{Q}', tip: 'rationals' }, { tex: '\\aleph', tip: 'aleph' },
    ],
  },
  {
    key: 'deco', label: '강조·괄호', items: [
      { tex: '\\hat{□}', tip: 'hat' }, { tex: '\\bar{□}', tip: 'bar' }, { tex: '\\vec{□}', tip: 'vector' }, { tex: '\\dot{□}', tip: 'dot' },
      { tex: '\\ddot{□}', tip: 'ddot' }, { tex: '\\tilde{□}', tip: 'tilde' }, { tex: '\\overline{□}', tip: 'overline' }, { tex: '\\underline{□}', tip: 'underline' },
      { tex: '\\overrightarrow{□}', tip: 'overrightarrow' }, { tex: '\\widehat{□}', tip: 'widehat' }, { tex: '\\overbrace{□}^{□}', tip: 'overbrace' }, { tex: '\\underbrace{□}_{□}', tip: 'underbrace' },
      { tex: '\\left( □ \\right)', tip: 'parens' }, { tex: '\\left[ □ \\right]', tip: 'brackets' }, { tex: '\\left\\{ □ \\right\\}', tip: 'braces' }, { tex: '\\left| □ \\right|', tip: 'abs' },
      { tex: '\\left\\| □ \\right\\|', tip: 'norm' }, { tex: '\\lfloor □ \\rfloor', tip: 'floor' }, { tex: '\\lceil □ \\rceil', tip: 'ceil' }, { tex: '\\langle □ \\rangle', tip: 'angle brackets' },
    ],
  },
  {
    key: 'func', label: '함수', items: [
      { tex: '\\sin', tip: 'sin' }, { tex: '\\cos', tip: 'cos' }, { tex: '\\tan', tip: 'tan' }, { tex: '\\csc', tip: 'csc' },
      { tex: '\\sec', tip: 'sec' }, { tex: '\\cot', tip: 'cot' }, { tex: '\\arcsin', tip: 'arcsin' }, { tex: '\\arccos', tip: 'arccos' },
      { tex: '\\arctan', tip: 'arctan' }, { tex: '\\sinh', tip: 'sinh' }, { tex: '\\cosh', tip: 'cosh' }, { tex: '\\tanh', tip: 'tanh' },
      { tex: '\\ln', tip: 'ln' }, { tex: '\\log', tip: 'log' }, { tex: '\\log_{□}', tip: 'log base' }, { tex: '\\exp', tip: 'exp' },
      { tex: '\\min', tip: 'min' }, { tex: '\\max', tip: 'max' }, { tex: '\\gcd', tip: 'gcd' }, { tex: '\\bmod', tip: 'mod' },
      { tex: '\\deg', tip: 'deg' }, { tex: '\\dim', tip: 'dim' }, { tex: '\\det', tip: 'det' }, { tex: '\\arg', tip: 'arg' },
    ],
  },
  {
    key: 'physics', label: '물리', items: [
      { tex: '\\hbar', tip: 'h-bar' }, { tex: '\\langle □ | □ \\rangle', tip: 'braket' }, { tex: '| □ \\rangle', tip: 'ket' }, { tex: '\\langle □ |', tip: 'bra' },
      { tex: '\\hat{H}', tip: 'Hamiltonian' }, { tex: '\\vec{F} = m\\vec{a}', tip: 'Newton 2nd' }, { tex: '\\vec{E}', tip: 'E field' }, { tex: '\\vec{B}', tip: 'B field' },
      { tex: '\\Delta', tip: 'delta/change' }, { tex: '^{\\circ}', tip: 'degree' }, { tex: '\\overset{\\circ}{A}', tip: 'angstrom' }, { tex: '\\odot', tip: 'sun symbol' },
      { tex: '\\propto', tip: 'proportional' }, { tex: '\\sum \\vec{F} = 0', tip: 'equilibrium' }, { tex: '\\rightleftharpoons', tip: 'reversible' }, { tex: '\\hslash', tip: 'hslash' },
    ],
  },
  {
    key: 'chem', label: '화학 (mhchem)', items: [
      { tex: '\\ce{H2O}', tip: 'water' }, { tex: '\\ce{CO2}', tip: 'CO2' }, { tex: '\\ce{2H2 + O2 -> 2H2O}', tip: 'reaction' }, { tex: '\\ce{A <=> B}', tip: 'equilibrium' },
      { tex: '\\ce{^{227}_{90}Th+}', tip: 'isotope+charge' }, { tex: '\\ce{SO4^2-}', tip: 'sulfate ion' }, { tex: '\\ce{H+}', tip: 'proton' }, { tex: '\\ce{e-}', tip: 'electron' },
      { tex: '\\ce{->[\\text{cat}]}', tip: 'arrow w/ condition' }, { tex: '\\ce{v ->}', tip: 'gas up' }, { tex: '\\ce{CaCO3 ->[\\Delta] CaO + CO2 ^}', tip: 'decomposition' }, { tex: '\\Delta H', tip: 'enthalpy' },
      { tex: '\\text{p}K_a', tip: 'pKa' }, { tex: '\\ce{[Cu(NH3)4]^2+}', tip: 'complex ion' }, { tex: 'K_{eq}', tip: 'equilibrium const' }, { tex: '\\ce{^.OH}', tip: 'radical' },
    ],
  },
  {
    key: 'units', label: '단위 (SI)', items: [
      { tex: '\\,\\text{m}', tip: 'meter' }, { tex: '\\,\\text{kg}', tip: 'kilogram' }, { tex: '\\,\\text{s}', tip: 'second' }, { tex: '\\,\\text{A}', tip: 'ampere' },
      { tex: '\\,\\text{K}', tip: 'kelvin' }, { tex: '\\,\\text{mol}', tip: 'mole' }, { tex: '\\,\\text{cd}', tip: 'candela' }, { tex: '\\,\\text{N}', tip: 'newton' },
      { tex: '\\,\\text{Pa}', tip: 'pascal' }, { tex: '\\,\\text{J}', tip: 'joule' }, { tex: '\\,\\text{W}', tip: 'watt' }, { tex: '\\,\\text{Hz}', tip: 'hertz' },
      { tex: '\\,\\text{V}', tip: 'volt' }, { tex: '\\,\\Omega', tip: 'ohm' }, { tex: '\\,\\text{F}', tip: 'farad' }, { tex: '\\,\\text{T}', tip: 'tesla' },
      { tex: '\\,\\text{m/s}', tip: 'm/s' }, { tex: '\\,\\text{m/s}^2', tip: 'm/s^2' }, { tex: '\\,\\mu\\text{m}', tip: 'micrometer' }, { tex: '\\,^{\\circ}\\text{C}', tip: 'celsius' },
    ],
  },
  {
    key: 'elec', label: '전기·회로', items: [
      { tex: '\\Omega', tip: 'ohm' }, { tex: '\\angle', tip: 'phase angle' }, { tex: 'V_{□}', tip: 'voltage' }, { tex: 'I_{□}', tip: 'current' },
      { tex: 'j\\omega', tip: 'j-omega' }, { tex: 'Z = R + jX', tip: 'impedance' }, { tex: '\\frac{1}{j\\omega C}', tip: 'cap impedance' }, { tex: 'j\\omega L', tip: 'ind impedance' },
      { tex: 'V \\angle \\theta', tip: 'phasor' }, { tex: '\\parallel', tip: 'parallel' }, { tex: '\\sum I = 0', tip: 'KCL' }, { tex: '\\sum V = 0', tip: 'KVL' },
    ],
  },
  {
    key: 'stat', label: '통계·확률', items: [
      { tex: '\\mathbb{E}[□]', tip: 'expectation' }, { tex: '\\mathrm{Var}(□)', tip: 'variance' }, { tex: '\\mathrm{Cov}(□,□)', tip: 'covariance' }, { tex: '\\bar{x}', tip: 'sample mean' },
      { tex: '\\hat{□}', tip: 'estimator' }, { tex: '\\sigma^2', tip: 'variance sym' }, { tex: '\\mu', tip: 'mean' }, { tex: '\\sim', tip: 'distributed as' },
      { tex: '\\mathcal{N}(\\mu, \\sigma^2)', tip: 'normal dist' }, { tex: 'P(□ \\mid □)', tip: 'conditional prob' }, { tex: '\\binom{n}{k}', tip: 'binomial coeff' }, { tex: '\\sum p_i = 1', tip: 'prob sum' },
      { tex: '\\rho', tip: 'correlation' }, { tex: '\\chi^2', tip: 'chi-square' }, { tex: '\\propto', tip: 'proportional' }, { tex: '\\overline{X}', tip: 'X bar' },
    ],
  },
  {
    key: 'eng', label: '공학 (기계·항공·건축)', items: [
      { tex: '\\mathrm{Re}', tip: 'Reynolds' }, { tex: '\\mathrm{Ma}', tip: 'Mach' }, { tex: '\\mathrm{Nu}', tip: 'Nusselt' }, { tex: '\\mathrm{Pr}', tip: 'Prandtl' },
      { tex: '\\sigma = \\frac{F}{A}', tip: 'stress' }, { tex: '\\varepsilon = \\frac{\\Delta L}{L}', tip: 'strain' }, { tex: '\\tau', tip: 'shear stress' }, { tex: '\\dot{m}', tip: 'mass flow' },
      { tex: '\\sum M = 0', tip: 'moment eq' }, { tex: '\\frac{dV}{dt}', tip: 'rate' }, { tex: '\\eta', tip: 'efficiency' }, { tex: '\\rho', tip: 'density' },
      { tex: 'C_L', tip: 'lift coeff' }, { tex: 'C_D', tip: 'drag coeff' }, { tex: '\\gamma', tip: 'specific weight' }, { tex: '\\nu', tip: 'kinematic visc' },
    ],
  },
  {
    key: 'cs', label: '전산·이산', items: [
      { tex: 'O(□)', tip: 'big-O' }, { tex: '\\Theta(□)', tip: 'big-Theta' }, { tex: '\\Omega(□)', tip: 'big-Omega' }, { tex: '\\lfloor □ \\rfloor', tip: 'floor' },
      { tex: '\\lceil □ \\rceil', tip: 'ceil' }, { tex: '\\oplus', tip: 'xor' }, { tex: '\\land', tip: 'and' }, { tex: '\\lor', tip: 'or' },
      { tex: '\\bmod', tip: 'mod' }, { tex: '\\gets', tip: 'assign' }, { tex: '\\sum_{i=1}^{n}', tip: 'sum loop' }, { tex: '\\mapsto', tip: 'maps to' },
      { tex: '\\in \\{0,1\\}', tip: 'binary' }, { tex: '\\neg', tip: 'negation' }, { tex: '\\models', tip: 'models' }, { tex: '\\vdash', tip: 'proves' },
    ],
  },
  {
    key: 'bio', label: '생물·바이오', items: [
      { tex: '\\rightarrow', tip: 'pathway' }, { tex: '\\rightleftharpoons', tip: 'reversible rxn' }, { tex: '\\xrightarrow{\\text{enzyme}}', tip: 'enzyme arrow' }, { tex: '\\Delta G', tip: 'Gibbs energy' },
      { tex: 'K_m', tip: 'Michaelis const' }, { tex: 'V_{max}', tip: 'Vmax' }, { tex: "5' \\rightarrow 3'", tip: 'five to three prime' }, { tex: '\\times', tip: 'cross (교배)' },
      { tex: '\\otimes', tip: 'crossed with' }, { tex: '\\dagger', tip: 'dagger' }, { tex: 'p^2 + 2pq + q^2 = 1', tip: 'Hardy-Weinberg' }, { tex: '\\text{[S]}', tip: 'substrate conc' },
    ],
  },
]

/** 큰 구조 템플릿 (분수·행렬·케이스 등) — 자리표시자 □ 포함 */
export const MATH_TEMPLATES2: Sym[] = [
  { tex: '\\frac{□}{□}', tip: '분수' },
  { tex: '□^{□}', tip: '위첨자' },
  { tex: '□_{□}', tip: '아래첨자' },
  { tex: '□_{□}^{□}', tip: '위·아래첨자' },
  { tex: '\\sqrt{□}', tip: '제곱근' },
  { tex: '\\sqrt[□]{□}', tip: 'n제곱근' },
  { tex: '\\sum_{□}^{□} □', tip: '합' },
  { tex: '\\prod_{□}^{□} □', tip: '곱' },
  { tex: '\\int_{□}^{□} □ \\, d□', tip: '정적분' },
  { tex: '\\lim_{□ \\to □} □', tip: '극한' },
  { tex: '\\begin{pmatrix} □ & □ \\\\ □ & □ \\end{pmatrix}', tip: '2×2 행렬' },
  { tex: '\\begin{pmatrix} □ & □ & □ \\\\ □ & □ & □ \\\\ □ & □ & □ \\end{pmatrix}', tip: '3×3 행렬' },
  { tex: '\\begin{bmatrix} □ \\\\ □ \\\\ □ \\end{bmatrix}', tip: '열벡터' },
  { tex: '\\begin{cases} □ & □ \\\\ □ & □ \\end{cases}', tip: '경우 분기' },
  { tex: '\\begin{aligned} □ &= □ \\\\ &= □ \\end{aligned}', tip: '정렬 방정식' },
  { tex: '\\binom{□}{□}', tip: '이항계수' },
  { tex: '\\overset{□}{□}', tip: '위에 얹기' },
  { tex: '\\underset{□}{□}', tip: '아래 얹기' },
]

/** 자주 쓰는 완성식 스니펫 (분야 대표 공식) */
export const MATH_SNIPPETS: Array<{ label: string; tex: string; field: string }> = [
  { field: '수학', label: '이차방정식 근', tex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { field: '수학', label: '오일러 항등식', tex: 'e^{i\\pi} + 1 = 0' },
  { field: '수학', label: '테일러 급수', tex: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n' },
  { field: '물리', label: '슈뢰딩거 방정식', tex: 'i\\hbar \\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi' },
  { field: '물리', label: '맥스웰(가우스)', tex: '\\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\varepsilon_0}' },
  { field: '물리', label: '상대성 에너지', tex: 'E = \\sqrt{(mc^2)^2 + (pc)^2}' },
  { field: '화학', label: '이상기체', tex: 'PV = nRT' },
  { field: '화학', label: '네른스트식', tex: 'E = E^{\\circ} - \\frac{RT}{nF}\\ln Q' },
  { field: '화학', label: '반응 예시', tex: '\\ce{N2 + 3H2 <=> 2NH3}' },
  { field: '통계', label: '정규분포 PDF', tex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}' },
  { field: '통계', label: '베이즈 정리', tex: 'P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}' },
  { field: '전기', label: '옴의 법칙(위상)', tex: '\\vec{V} = \\vec{I}\\,Z' },
  { field: '전기', label: '커패시터 임피던스', tex: 'Z_C = \\frac{1}{j\\omega C}' },
  { field: '기계', label: '레이놀즈 수', tex: '\\mathrm{Re} = \\frac{\\rho v L}{\\mu}' },
  { field: '기계', label: '베르누이', tex: 'P + \\tfrac{1}{2}\\rho v^2 + \\rho g h = \\text{const}' },
  { field: '항공', label: '양력', tex: 'L = \\tfrac{1}{2}\\rho v^2 S C_L' },
  { field: '생물', label: '미카엘리스-멘텐', tex: 'v = \\frac{V_{max}[S]}{K_m + [S]}' },
  { field: '생물', label: '하디-바인베르크', tex: 'p^2 + 2pq + q^2 = 1' },
  { field: '전산', label: '엔트로피', tex: 'H(X) = -\\sum_{i} p_i \\log_2 p_i' },
  { field: '건축', label: '휨응력', tex: '\\sigma = \\frac{M c}{I}' },
]
