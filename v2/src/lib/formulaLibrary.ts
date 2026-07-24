/**
 * 전 이공계 대표 공식 라이브러리 — 분야별 110+ 종.
 * 전부 KaTeX(+mhchem) 렌더 가능 표현식만 수록.
 */
export interface Formula { field: string; label: string; tex: string; alias?: string }

export const FORMULA_FIELDS = ['수학', '물리', '화학', '통계', '전기', '기계', '항공', '건축', '전산·AI', '생물·바이오'] as const

export const FORMULA_LIBRARY: Formula[] = [
  /* ── 수학 ── */
  { field: '수학', label: '이차방정식 근의 공식', alias: 'quadratic', tex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { field: '수학', label: '오일러 항등식', alias: 'euler identity', tex: 'e^{i\\pi} + 1 = 0' },
  { field: '수학', label: '오일러 공식', alias: 'euler formula', tex: 'e^{i\\theta} = \\cos\\theta + i\\sin\\theta' },
  { field: '수학', label: '테일러 급수', alias: 'taylor', tex: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n' },
  { field: '수학', label: '푸리에 변환', alias: 'fourier', tex: '\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\, e^{-2\\pi i x \\xi}\\, dx' },
  { field: '수학', label: '푸리에 급수', alias: 'fourier series', tex: 'f(x) = \\frac{a_0}{2} + \\sum_{n=1}^{\\infty}\\left(a_n \\cos nx + b_n \\sin nx\\right)' },
  { field: '수학', label: '라플라스 변환', alias: 'laplace', tex: 'F(s) = \\int_{0}^{\\infty} f(t)\\, e^{-st}\\, dt' },
  { field: '수학', label: '미적분학 기본정리', alias: 'ftc', tex: '\\int_a^b f(x)\\,dx = F(b) - F(a)' },
  { field: '수학', label: '부분적분', alias: 'integration by parts', tex: '\\int u\\,dv = uv - \\int v\\,du' },
  { field: '수학', label: '코시-슈바르츠 부등식', alias: 'cauchy schwarz', tex: '\\left|\\langle u, v\\rangle\\right|^2 \\le \\langle u,u\\rangle \\cdot \\langle v,v\\rangle' },
  { field: '수학', label: '피타고라스 정리', alias: 'pythagorean', tex: 'a^2 + b^2 = c^2' },
  { field: '수학', label: '드무아브르 정리', alias: 'de moivre', tex: '(\\cos\\theta + i\\sin\\theta)^n = \\cos n\\theta + i\\sin n\\theta' },
  { field: '수학', label: '행렬식 2×2', alias: 'determinant', tex: '\\det\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} = ad - bc' },
  { field: '수학', label: '고유값 방정식', alias: 'eigenvalue', tex: 'A\\vec{v} = \\lambda\\vec{v}' },
  { field: '수학', label: '스토크스 정리', alias: 'stokes', tex: '\\oint_{\\partial S} \\vec{F} \\cdot d\\vec{r} = \\iint_S (\\nabla \\times \\vec{F}) \\cdot d\\vec{S}' },
  { field: '수학', label: '발산 정리', alias: 'divergence theorem gauss', tex: '\\iint_{\\partial V} \\vec{F} \\cdot d\\vec{S} = \\iiint_V (\\nabla \\cdot \\vec{F})\\, dV' },

  /* ── 물리 ── */
  { field: '물리', label: '뉴턴 제2법칙', alias: 'newton', tex: '\\vec{F} = m\\vec{a} = \\frac{d\\vec{p}}{dt}' },
  { field: '물리', label: '만유인력', alias: 'gravitation', tex: 'F = G\\frac{m_1 m_2}{r^2}' },
  { field: '물리', label: '운동에너지', alias: 'kinetic energy', tex: 'E_k = \\tfrac{1}{2}mv^2' },
  { field: '물리', label: '질량-에너지 등가', alias: 'emc2', tex: 'E = mc^2' },
  { field: '물리', label: '상대론적 에너지', alias: 'relativistic energy', tex: 'E^2 = (mc^2)^2 + (pc)^2' },
  { field: '물리', label: '로렌츠 인자', alias: 'lorentz', tex: '\\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}' },
  { field: '물리', label: '슈뢰딩거 방정식', alias: 'schrodinger', tex: 'i\\hbar \\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi' },
  { field: '물리', label: '하이젠베르크 불확정성', alias: 'uncertainty', tex: '\\Delta x \\, \\Delta p \\ge \\frac{\\hbar}{2}' },
  { field: '물리', label: '드브로이 파장', alias: 'de broglie', tex: '\\lambda = \\frac{h}{p}' },
  { field: '물리', label: '플랑크 에너지', alias: 'planck', tex: 'E = h\\nu = \\hbar\\omega' },
  { field: '물리', label: '맥스웰: 가우스 법칙', alias: 'maxwell gauss', tex: '\\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\varepsilon_0}' },
  { field: '물리', label: '맥스웰: 자기 가우스', alias: 'maxwell magnetic', tex: '\\nabla \\cdot \\vec{B} = 0' },
  { field: '물리', label: '맥스웰: 패러데이', alias: 'faraday', tex: '\\nabla \\times \\vec{E} = -\\frac{\\partial \\vec{B}}{\\partial t}' },
  { field: '물리', label: '맥스웰: 앙페르', alias: 'ampere', tex: '\\nabla \\times \\vec{B} = \\mu_0 \\vec{J} + \\mu_0\\varepsilon_0 \\frac{\\partial \\vec{E}}{\\partial t}' },
  { field: '물리', label: '로렌츠 힘', alias: 'lorentz force', tex: '\\vec{F} = q(\\vec{E} + \\vec{v} \\times \\vec{B})' },
  { field: '물리', label: '쿨롱 법칙', alias: 'coulomb', tex: 'F = \\frac{1}{4\\pi\\varepsilon_0}\\frac{q_1 q_2}{r^2}' },
  { field: '물리', label: '열역학 제1법칙', alias: 'first law thermodynamics', tex: '\\Delta U = Q - W' },
  { field: '물리', label: '엔트로피 (볼츠만)', alias: 'boltzmann entropy', tex: 'S = k_B \\ln \\Omega' },
  { field: '물리', label: '이상기체 내부에너지', alias: 'internal energy', tex: 'U = \\tfrac{3}{2}nRT' },
  { field: '물리', label: '단순 조화 진동', alias: 'harmonic oscillator', tex: 'x(t) = A\\cos(\\omega t + \\phi), \\quad \\omega = \\sqrt{k/m}' },
  { field: '물리', label: '도플러 효과', alias: 'doppler', tex: 'f' + "'" + ' = f\\frac{v \\pm v_o}{v \\mp v_s}' },

  /* ── 화학 ── */
  { field: '화학', label: '이상기체 방정식', alias: 'ideal gas', tex: 'PV = nRT' },
  { field: '화학', label: '깁스 자유에너지', alias: 'gibbs', tex: '\\Delta G = \\Delta H - T\\Delta S' },
  { field: '화학', label: '네른스트 식', alias: 'nernst', tex: 'E = E^{\\circ} - \\frac{RT}{nF}\\ln Q' },
  { field: '화학', label: '아레니우스 식', alias: 'arrhenius', tex: 'k = A e^{-E_a / RT}' },
  { field: '화학', label: '헨더슨-하셀바흐', alias: 'henderson hasselbalch', tex: '\\text{pH} = \\text{p}K_a + \\log\\frac{[\\text{A}^-]}{[\\text{HA}]}' },
  { field: '화학', label: '평형상수', alias: 'equilibrium constant', tex: 'K_{eq} = \\frac{[\\text{C}]^c[\\text{D}]^d}{[\\text{A}]^a[\\text{B}]^b}' },
  { field: '화학', label: '반트호프 식', alias: 'vant hoff', tex: '\\ln\\frac{K_2}{K_1} = -\\frac{\\Delta H^{\\circ}}{R}\\left(\\frac{1}{T_2} - \\frac{1}{T_1}\\right)' },
  { field: '화학', label: '비어-람베르트 법칙', alias: 'beer lambert', tex: 'A = \\varepsilon l c' },
  { field: '화학', label: '암모니아 합성 (하버)', alias: 'haber', tex: '\\ce{N2 + 3H2 <=>[{\\text{Fe}}] 2NH3}' },
  { field: '화학', label: '연소 반응 예', alias: 'combustion', tex: '\\ce{CH4 + 2O2 -> CO2 + 2H2O}' },
  { field: '화학', label: '산-염기 중화', alias: 'neutralization', tex: '\\ce{HCl + NaOH -> NaCl + H2O}' },
  { field: '화학', label: '라울 법칙', alias: 'raoult', tex: 'P_i = x_i P_i^{\\circ}' },
  { field: '화학', label: '반감기 (1차 반응)', alias: 'half life', tex: 't_{1/2} = \\frac{\\ln 2}{k}' },

  /* ── 통계 ── */
  { field: '통계', label: '정규분포 PDF', alias: 'normal gaussian', tex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}' },
  { field: '통계', label: '베이즈 정리', alias: 'bayes', tex: 'P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}' },
  { field: '통계', label: '기대값 정의', alias: 'expectation', tex: '\\mathbb{E}[X] = \\sum_i x_i p_i' },
  { field: '통계', label: '분산 정의', alias: 'variance', tex: '\\mathrm{Var}(X) = \\mathbb{E}[X^2] - (\\mathbb{E}[X])^2' },
  { field: '통계', label: '표본표준편차', alias: 'sample std', tex: 's = \\sqrt{\\frac{1}{n-1}\\sum_{i=1}^{n}(x_i - \\bar{x})^2}' },
  { field: '통계', label: '이항분포 PMF', alias: 'binomial', tex: 'P(X=k) = \\binom{n}{k} p^k (1-p)^{n-k}' },
  { field: '통계', label: '포아송 분포', alias: 'poisson', tex: 'P(X=k) = \\frac{\\lambda^k e^{-\\lambda}}{k!}' },
  { field: '통계', label: '상관계수', alias: 'correlation pearson', tex: 'r = \\frac{\\sum (x_i - \\bar{x})(y_i - \\bar{y})}{\\sqrt{\\sum (x_i-\\bar{x})^2}\\sqrt{\\sum (y_i-\\bar{y})^2}}' },
  { field: '통계', label: '최소제곱 회귀계수', alias: 'least squares', tex: '\\hat{\\beta} = (X^T X)^{-1} X^T y' },
  { field: '통계', label: '중심극한정리', alias: 'clt', tex: '\\frac{\\bar{X} - \\mu}{\\sigma/\\sqrt{n}} \\xrightarrow{d} \\mathcal{N}(0, 1)' },
  { field: '통계', label: '신뢰구간 (95%)', alias: 'confidence interval', tex: '\\bar{x} \\pm 1.96\\,\\frac{\\sigma}{\\sqrt{n}}' },
  { field: '통계', label: 't 통계량', alias: 't statistic', tex: 't = \\frac{\\bar{x} - \\mu_0}{s/\\sqrt{n}}' },

  /* ── 전기 ── */
  { field: '전기', label: '옴의 법칙', alias: 'ohm', tex: 'V = IR' },
  { field: '전기', label: '전력', alias: 'power', tex: 'P = VI = I^2 R = \\frac{V^2}{R}' },
  { field: '전기', label: '임피던스 (직렬 RLC)', alias: 'impedance', tex: 'Z = R + j\\left(\\omega L - \\frac{1}{\\omega C}\\right)' },
  { field: '전기', label: '공진 주파수', alias: 'resonance', tex: 'f_0 = \\frac{1}{2\\pi\\sqrt{LC}}' },
  { field: '전기', label: '키르히호프 전류법칙', alias: 'kcl', tex: '\\sum_{k} I_k = 0' },
  { field: '전기', label: '키르히호프 전압법칙', alias: 'kvl', tex: '\\sum_{k} V_k = 0' },
  { field: '전기', label: '커패시터 에너지', alias: 'capacitor energy', tex: 'E = \\tfrac{1}{2}CV^2' },
  { field: '전기', label: 'RC 시정수', alias: 'rc time constant', tex: '\\tau = RC, \\quad v(t) = V_0 e^{-t/\\tau}' },
  { field: '전기', label: '변압기 권수비', alias: 'transformer', tex: '\\frac{V_1}{V_2} = \\frac{N_1}{N_2}' },
  { field: '전기', label: '전달함수 (2차계)', alias: 'transfer function', tex: 'H(s) = \\frac{\\omega_n^2}{s^2 + 2\\zeta\\omega_n s + \\omega_n^2}' },

  /* ── 기계 ── */
  { field: '기계', label: '베르누이 방정식', alias: 'bernoulli', tex: 'P + \\tfrac{1}{2}\\rho v^2 + \\rho g h = \\text{const}' },
  { field: '기계', label: '레이놀즈 수', alias: 'reynolds', tex: '\\mathrm{Re} = \\frac{\\rho v L}{\\mu}' },
  { field: '기계', label: '나비에-스토크스', alias: 'navier stokes', tex: '\\rho\\left(\\frac{\\partial \\vec{v}}{\\partial t} + \\vec{v}\\cdot\\nabla\\vec{v}\\right) = -\\nabla p + \\mu\\nabla^2\\vec{v} + \\vec{f}' },
  { field: '기계', label: '후크 법칙 (응력)', alias: 'hooke stress', tex: '\\sigma = E\\varepsilon' },
  { field: '기계', label: '전단응력', alias: 'shear', tex: '\\tau = \\frac{VQ}{Ib}' },
  { field: '기계', label: '열전도 (푸리에)', alias: 'fourier conduction', tex: 'q = -kA\\frac{dT}{dx}' },
  { field: '기계', label: '대류 열전달 (뉴턴 냉각)', alias: 'newton cooling', tex: 'q = hA(T_s - T_{\\infty})' },
  { field: '기계', label: '카르노 효율', alias: 'carnot', tex: '\\eta = 1 - \\frac{T_C}{T_H}' },
  { field: '기계', label: '질량 유량 연속방정식', alias: 'continuity', tex: '\\dot{m} = \\rho_1 A_1 v_1 = \\rho_2 A_2 v_2' },
  { field: '기계', label: '비틀림 전단응력', alias: 'torsion', tex: '\\tau = \\frac{T r}{J}' },
  { field: '기계', label: '스프링-질량 고유진동수', alias: 'natural frequency', tex: 'f_n = \\frac{1}{2\\pi}\\sqrt{\\frac{k}{m}}' },

  /* ── 항공 ── */
  { field: '항공', label: '양력 방정식', alias: 'lift', tex: 'L = \\tfrac{1}{2}\\rho v^2 S C_L' },
  { field: '항공', label: '항력 방정식', alias: 'drag', tex: 'D = \\tfrac{1}{2}\\rho v^2 S C_D' },
  { field: '항공', label: '마하 수', alias: 'mach', tex: '\\mathrm{Ma} = \\frac{v}{a}, \\quad a = \\sqrt{\\gamma R T}' },
  { field: '항공', label: '추력 (제트)', alias: 'thrust', tex: 'T = \\dot{m}(v_e - v_0) + (p_e - p_0)A_e' },
  { field: '항공', label: '치올콥스키 로켓 방정식', alias: 'rocket tsiolkovsky', tex: '\\Delta v = v_e \\ln\\frac{m_0}{m_f}' },
  { field: '항공', label: '브레게 항속거리', alias: 'breguet range', tex: 'R = \\frac{v}{c_t}\\frac{L}{D}\\ln\\frac{W_0}{W_1}' },
  { field: '항공', label: '궤도 속도', alias: 'orbital velocity', tex: 'v = \\sqrt{\\frac{GM}{r}}' },
  { field: '항공', label: '등엔트로피 관계', alias: 'isentropic', tex: '\\frac{T_2}{T_1} = \\left(\\frac{p_2}{p_1}\\right)^{\\frac{\\gamma-1}{\\gamma}}' },

  /* ── 건축 ── */
  { field: '건축', label: '휨응력 공식', alias: 'bending stress', tex: '\\sigma = \\frac{Mc}{I}' },
  { field: '건축', label: '오일러 좌굴하중', alias: 'euler buckling', tex: 'P_{cr} = \\frac{\\pi^2 EI}{(KL)^2}' },
  { field: '건축', label: '단순보 중앙 처짐', alias: 'beam deflection', tex: '\\delta_{max} = \\frac{5wL^4}{384EI}' },
  { field: '건축', label: '단순보 최대 모멘트', alias: 'max moment', tex: 'M_{max} = \\frac{wL^2}{8}' },
  { field: '건축', label: '정역학 평형조건', alias: 'static equilibrium', tex: '\\sum F_x = 0, \\quad \\sum F_y = 0, \\quad \\sum M = 0' },
  { field: '건축', label: '콘크리트 압축강도 설계', alias: 'concrete strength', tex: '\\phi P_n \\ge P_u' },
  { field: '건축', label: '관성모멘트 (직사각형)', alias: 'moment of inertia', tex: 'I = \\frac{bh^3}{12}' },
  { field: '건축', label: '지진 밑면전단력', alias: 'seismic base shear', tex: 'V = C_s W' },

  /* ── 전산·AI ── */
  { field: '전산·AI', label: '섀넌 엔트로피', alias: 'entropy shannon', tex: 'H(X) = -\\sum_{i} p_i \\log_2 p_i' },
  { field: '전산·AI', label: '크로스 엔트로피 손실', alias: 'cross entropy', tex: '\\mathcal{L} = -\\sum_{i} y_i \\log \\hat{y}_i' },
  { field: '전산·AI', label: '소프트맥스', alias: 'softmax', tex: '\\sigma(z)_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}' },
  { field: '전산·AI', label: '어텐션 (트랜스포머)', alias: 'attention transformer', tex: '\\mathrm{Attention}(Q,K,V) = \\mathrm{softmax}\\!\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V' },
  { field: '전산·AI', label: '경사하강법', alias: 'gradient descent', tex: '\\theta_{t+1} = \\theta_t - \\eta \\nabla_{\\theta} \\mathcal{L}(\\theta_t)' },
  { field: '전산·AI', label: '시그모이드', alias: 'sigmoid', tex: '\\sigma(x) = \\frac{1}{1 + e^{-x}}' },
  { field: '전산·AI', label: 'ReLU', alias: 'relu', tex: '\\mathrm{ReLU}(x) = \\max(0, x)' },
  { field: '전산·AI', label: 'KL 발산', alias: 'kl divergence', tex: 'D_{KL}(P \\| Q) = \\sum_i P(i) \\log\\frac{P(i)}{Q(i)}' },
  { field: '전산·AI', label: '마스터 정리 (분할정복)', alias: 'master theorem', tex: 'T(n) = aT(n/b) + f(n)' },
  { field: '전산·AI', label: '빅오 정의', alias: 'big o', tex: 'f(n) = O(g(n)) \\iff \\exists c, n_0 : f(n) \\le c\\,g(n)' },
  { field: '전산·AI', label: '베이즈 분류기', alias: 'naive bayes', tex: '\\hat{y} = \\arg\\max_y P(y)\\prod_i P(x_i \\mid y)' },
  { field: '전산·AI', label: 'PageRank', alias: 'pagerank', tex: 'PR(u) = \\frac{1-d}{N} + d\\sum_{v \\in B_u} \\frac{PR(v)}{L(v)}' },

  /* ── 생물·바이오 ── */
  { field: '생물·바이오', label: '미카엘리스-멘텐', alias: 'michaelis menten', tex: 'v = \\frac{V_{max}[\\text{S}]}{K_m + [\\text{S}]}' },
  { field: '생물·바이오', label: '하디-바인베르크', alias: 'hardy weinberg', tex: 'p^2 + 2pq + q^2 = 1' },
  { field: '생물·바이오', label: '로지스틱 성장', alias: 'logistic growth', tex: '\\frac{dN}{dt} = rN\\left(1 - \\frac{N}{K}\\right)' },
  { field: '생물·바이오', label: '지수 성장', alias: 'exponential growth', tex: 'N(t) = N_0 e^{rt}' },
  { field: '생물·바이오', label: '광합성 총반응', alias: 'photosynthesis', tex: '\\ce{6CO2 + 6H2O ->[{h\\nu}] C6H12O6 + 6O2}' },
  { field: '생물·바이오', label: '세포호흡', alias: 'respiration', tex: '\\ce{C6H12O6 + 6O2 -> 6CO2 + 6H2O} + \\text{ATP}' },
  { field: '생물·바이오', label: '골드만 방정식', alias: 'goldman', tex: 'V_m = \\frac{RT}{F}\\ln\\frac{P_K[\\text{K}^+]_o + P_{Na}[\\text{Na}^+]_o}{P_K[\\text{K}^+]_i + P_{Na}[\\text{Na}^+]_i}' },
  { field: '생물·바이오', label: '네른스트 전위 (이온)', alias: 'nernst potential', tex: 'E_{ion} = \\frac{RT}{zF}\\ln\\frac{[\\text{ion}]_o}{[\\text{ion}]_i}' },
  { field: '생물·바이오', label: '희석 공식', alias: 'dilution', tex: 'C_1 V_1 = C_2 V_2' },
  { field: '생물·바이오', label: 'PCR 증폭량', alias: 'pcr', tex: 'N = N_0 \\times 2^n' },
]

/** 물리 상수 (CODATA 근사값) — 삽입 시 값 포함 여부 선택 */
export const PHYSICAL_CONSTANTS: Array<{ label: string; sym: string; value: string }> = [
  { label: '빛의 속도', sym: 'c', value: 'c = 2.998 \\times 10^8 \\,\\text{m/s}' },
  { label: '플랑크 상수', sym: 'h', value: 'h = 6.626 \\times 10^{-34} \\,\\text{J·s}' },
  { label: '디랙 상수', sym: '\\hbar', value: '\\hbar = 1.055 \\times 10^{-34} \\,\\text{J·s}' },
  { label: '중력 상수', sym: 'G', value: 'G = 6.674 \\times 10^{-11} \\,\\text{N·m}^2/\\text{kg}^2' },
  { label: '기본 전하', sym: 'e', value: 'e = 1.602 \\times 10^{-19} \\,\\text{C}' },
  { label: '전자 질량', sym: 'm_e', value: 'm_e = 9.109 \\times 10^{-31} \\,\\text{kg}' },
  { label: '양성자 질량', sym: 'm_p', value: 'm_p = 1.673 \\times 10^{-27} \\,\\text{kg}' },
  { label: '아보가드로 수', sym: 'N_A', value: 'N_A = 6.022 \\times 10^{23} \\,\\text{mol}^{-1}' },
  { label: '볼츠만 상수', sym: 'k_B', value: 'k_B = 1.381 \\times 10^{-23} \\,\\text{J/K}' },
  { label: '기체 상수', sym: 'R', value: 'R = 8.314 \\,\\text{J/(mol·K)}' },
  { label: '진공 유전율', sym: '\\varepsilon_0', value: '\\varepsilon_0 = 8.854 \\times 10^{-12} \\,\\text{F/m}' },
  { label: '진공 투자율', sym: '\\mu_0', value: '\\mu_0 = 4\\pi \\times 10^{-7} \\,\\text{H/m}' },
  { label: '스테판-볼츠만', sym: '\\sigma', value: '\\sigma = 5.670 \\times 10^{-8} \\,\\text{W/(m}^2\\text{K}^4)' },
  { label: '중력 가속도', sym: 'g', value: 'g = 9.807 \\,\\text{m/s}^2' },
]
