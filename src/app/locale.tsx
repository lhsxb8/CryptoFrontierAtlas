import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const en = {
  loadingAtlas: 'Loading atlas…', loadFailed: 'The atlas could not be loaded. Check your connection and reload.', reloadAtlas: 'Reload',
  home: 'Home', questions: 'Open questions', analysis: 'Symmetric cryptanalysis',
  asymmetric: 'Asymmetric cryptanalysis', implementation: 'Implementation',
  primaryNavigation: 'Primary navigation', collectionNavigation: 'Collection navigation',
  questionIndex: 'Question index', questionCitations: 'Question citations',
  cipherDirectory: 'Primitive & construction directory', analysisSources: 'Analysis sources', coverage: 'Coverage & audit',
  skip: 'Skip to content',
  repository: 'Repository', backHome: 'Back to home',
  analysisEmptyTitle: 'Symmetric cryptanalysis results',
  searchPrimitives: 'Search primitives and instances', primitiveType: 'Primitive type', allPrimitiveTypes: 'All primitive types',
  registeredPrimitives: 'primitives / constructions', instancesLabel: 'instances',
  noCataloguedResults: 'No catalogued results',
  noMatchingPrimitives: 'No matching primitives', resetFilters: 'Reset filters',
  specificationsTitle: 'Specifications', historicalStandard: 'Historical · withdrawn specification',
  withdrawnStandard: 'Withdrawn', specificationDetails: 'Details',
  specificationChecked: 'Status checked', usesPrimitives: 'Uses', allInstances: 'All instances',
  noRegisteredInstances: 'No concrete instances registered yet.', unknownPrimitive: 'This primitive or instance is not registered.',
  dataRevision: 'Data revision', versionInfo: 'Version',
  contributeResult: 'Contribute a result',
  language: 'Language',
  languageScope: 'Interface language only; research text and references keep their original language.',
  help: 'Help', helpTitle: 'Help',
  helpCostsTitle: 'Costs & comparison',
  helpCosts: 'Time, data, memory and preprocessing use the source’s units. Compare matching targets, settings, success events and cost accounting. Unreported probabilities remain unknown.',
  helpAccess: 'CPA: chosen plaintext · CCA: chosen ciphertext · KPA: known plaintext.',
  helpEvidenceTitle: 'Evidence',
  helpEvidence: 'Sources identify the inspected version and result location. Publication, source review, experimental reproduction and Lean verification are separate statuses. Coverage counts catalogued results.',
  report: 'Report', reportTitle: 'Contribute & report',
  reportChannel: 'Submission route', accepted: 'Accepted / published paper',
  lean: 'Lean formalization', preprint: 'Preprint',
  dataCorrection: 'Data correction / missing result', websiteFeedback: 'Website bug / feature suggestion',
  materials: 'Prepare these materials',
  acceptedMaterials: 'Paper and version; public acceptance or publication evidence; result statements, parameters, costs and success; exact pages, tables or theorems.',
  leanMaterials: 'Public source at a fixed commit; theorem statements and names; pinned toolchain and dependencies; replay command and axiom report; correspondence to the reported result.',
  preprintMaterials: 'Public manuscript and version date or number; result statements and assumptions; parameters, costs and success; proof and result locations.',
  dataCorrectionMaterials: 'Affected page or record, what is wrong or missing, and a source or explanation supporting the update.',
  websiteFeedbackMaterials: 'Page and reproduction steps for a bug, or the use case and expected behavior for a suggestion. Report security vulnerabilities through the repository’s Security policy.',
  publicNotice: 'GitHub reports are public. Include only material you can share publicly.',
  continueGithub: 'Continue on GitHub', submissionGuide: 'Submission guide',
  close: 'Close dialog', pageNotFound: 'Page not found', recordNotFound: 'Record not found',
  researchCollections: 'Research collections', compareResults: 'Compare results',
};

type Messages = { [Key in keyof typeof en]: string };
const zh: Messages = {
  loadingAtlas: '正在加载图谱…', loadFailed: '图谱加载失败，请检查网络连接后重试。', reloadAtlas: '重新加载',
  home: '主页', questions: '开放问题', analysis: '对称密码分析',
  asymmetric: '非对称密码分析', implementation: '实现',
  primaryNavigation: '主导航', collectionNavigation: '数据集导航',
  questionIndex: '问题索引', questionCitations: '问题文献',
  cipherDirectory: '原语与构造目录', analysisSources: '分析文献', coverage: '覆盖与审核',
  skip: '跳转到正文',
  repository: '代码仓库', backHome: '返回主页',
  analysisEmptyTitle: '对称密码分析结果',
  searchPrimitives: '搜索原语与实例', primitiveType: '原语类别', allPrimitiveTypes: '所有原语类别',
  registeredPrimitives: '种原语／构造', instancesLabel: '个实例',
  noCataloguedResults: '尚未收录结果',
  noMatchingPrimitives: '没有匹配的原语', resetFilters: '重置筛选',
  specificationsTitle: '定义规范', historicalStandard: '历史规范 · 已撤回',
  withdrawnStandard: '已撤回', specificationDetails: '详情',
  specificationChecked: '状态核对', usesPrimitives: '使用的原语', allInstances: '所有实例',
  noRegisteredInstances: '尚未登记具体实例。', unknownPrimitive: '该原语或实例尚未登记。',
  dataRevision: '数据修订', versionInfo: '版本信息',
  contributeResult: '提交研究结果',
  language: '语言',
  languageScope: '仅切换界面语言；研究正文与文献保留原文。',
  help: '帮助', helpTitle: '帮助',
  helpCostsTitle: '复杂度与比较',
  helpCosts: '时间、数据、内存和预处理使用原文单位。比较须匹配目标、setting、成功事件和成本口径；未报告的概率保持未知。',
  helpAccess: 'CPA：选择明文 · CCA：选择密文 · KPA：已知明文。',
  helpEvidenceTitle: '证据',
  helpEvidence: '来源标明所核对的版本和结果位置。发表、原文审核、实验复现与 Lean 验证分别记录；覆盖统计仅计已收录结果。',
  report: 'Report', reportTitle: '贡献与反馈',
  reportChannel: '提交方式', accepted: '已录用／已发表论文',
  lean: 'Lean 形式化验证', preprint: '预印本',
  dataCorrection: '数据纠错／遗漏', websiteFeedback: '网站问题／功能建议',
  materials: '需要准备的材料',
  acceptedMaterials: '论文与具体版本；公开录用或出版依据；结果陈述、参数、复杂度与成功率；对应页码、表格或定理。',
  leanMaterials: '固定 commit 的公开源码；定理陈述与名称；锁定的工具链和依赖；复核命令及公理依赖报告；与所报告结果的对应关系。',
  preprintMaterials: '公开稿件与版本日期或编号；结果陈述和假设；参数、复杂度与成功率；证明及结果位置。',
  dataCorrectionMaterials: '相关页面或记录、错误或遗漏的内容，以及支持修改的来源或说明。',
  websiteFeedbackMaterials: '网站问题请提供页面和复现步骤；功能建议请说明使用场景与预期行为。安全漏洞请按仓库的 Security policy 私下报告。',
  publicNotice: 'GitHub 报告公开可见，请只提交可以公开分享的材料。',
  continueGithub: '前往 GitHub 填写', submissionGuide: '提交规范',
  close: '关闭弹窗', pageNotFound: '页面不存在', recordNotFound: '记录不存在',
  researchCollections: '研究数据集', compareResults: '比较结果',
};

export type Locale = 'en' | 'zh';
export type MessageKey = keyof Messages;
export const LOCALE_STORAGE_KEY = 'atlas.locale';
const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; text: Messages } | null>(null);

function readInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch { /* Language selection also works when storage is unavailable. */ }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function LocaleProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocale] = useState<Locale>(() => initialLocale ?? readInitialLocale());
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    try { localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* Session-only preference. */ }
  }, [locale]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY && (event.newValue === 'en' || event.newValue === 'zh')) setLocale(event.newValue);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const value = useMemo(() => ({ locale, setLocale, text: locale === 'zh' ? zh : en }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale requires LocaleProvider');
  return context;
}
