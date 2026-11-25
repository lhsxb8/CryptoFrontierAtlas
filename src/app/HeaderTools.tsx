import { useState } from 'react';
import { ArrowUpRight, Check, CircleHelp, FilePlus2, Languages } from 'lucide-react';
import Modal from '../components/Modal';
import { useLocale } from './locale';
import { appVersion } from './version';
import { releaseMetadata } from '../features/primitives/data';
import { submissionRoutes, submissionUrl, SUBMISSION_GUIDE_URL, type SubmissionRoute } from './reporting';

type DialogName = 'language' | 'help' | 'report';

export default function HeaderTools() {
  const { locale, setLocale, text } = useLocale();
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [channel, setChannel] = useState<SubmissionRoute>('accepted-paper');
  const close = () => setDialog(null);
  const channels = {
    'accepted-paper': { name: text.accepted, materials: text.acceptedMaterials },
    'lean-formalization': { name: text.lean, materials: text.leanMaterials },
    preprint: { name: text.preprint, materials: text.preprintMaterials },
  };
  return <>
    <div className="atlas-header-tools">
      <button type="button" aria-label={text.language} aria-haspopup="dialog" aria-expanded={dialog === 'language'} onClick={() => setDialog('language')}><Languages size={17} aria-hidden="true" /><span>{locale === 'zh' ? '中文' : 'EN'}</span></button>
      <button type="button" aria-label={text.help} aria-haspopup="dialog" aria-expanded={dialog === 'help'} onClick={() => setDialog('help')}><CircleHelp size={17} aria-hidden="true" /><span className="atlas-tool-label">{text.help}</span></button>
      <button type="button" aria-label={text.report} aria-haspopup="dialog" aria-expanded={dialog === 'report'} onClick={() => setDialog('report')}><FilePlus2 size={17} aria-hidden="true" /><span className="atlas-tool-label">{text.report}</span></button>
    </div>
    {dialog && <Modal key={dialog} title={dialog === 'language' ? text.language : dialog === 'help' ? text.helpTitle : text.reportTitle}
      closeLabel={text.close} onClose={close}
      footer={dialog === 'report' ? <>
        <div className="atlas-dialog-actions">{submissionUrl(channel)
          ? <a className="atlas-button" href={submissionUrl(channel)!} target="_blank" rel="noreferrer">{text.continueGithub}<ArrowUpRight size={15} aria-hidden="true" /></a>
          : <span role="status">{locale === 'zh' ? '配置公开仓库地址后即可在 GitHub 提交。' : 'GitHub reporting opens when the public repository is configured.'}</span>}
          <a className="atlas-text-link" href={SUBMISSION_GUIDE_URL} target="_blank" rel="noreferrer">{text.submissionGuide}<ArrowUpRight size={14} aria-hidden="true" /></a></div>
        <p>{text.publicNotice}</p>
      </> : undefined}>
      {dialog === 'language' ? <div className="atlas-dialog-body">
        <div className="atlas-language-options">{([{ id: 'en', name: 'English', lang: 'en' }, { id: 'zh', name: '简体中文', lang: 'zh-CN' }] as const).map(option =>
          <button type="button" key={option.id} lang={option.lang} aria-pressed={locale === option.id} onClick={() => setLocale(option.id)}><span>{option.name}</span>{locale === option.id && <Check size={18} aria-hidden="true" />}</button>)}</div>
        <p className="atlas-dialog-note">{text.languageScope}</p>
      </div> : dialog === 'help' ? <div className="atlas-dialog-body atlas-help-content">
        <section><h3>{text.helpCostsTitle}</h3><p>{text.helpCosts}</p><p>{text.helpAccess}</p></section>
        <section><h3>{text.helpEvidenceTitle}</h3><p>{text.helpEvidence}</p></section>
        <details className="atlas-version-details"><summary>{text.versionInfo}</summary><dl>
          <div><dt>CryptoFrontierAtlas</dt><dd>v{appVersion}</dd></div>
          <div><dt>{text.dataRevision}</dt><dd><code>{releaseMetadata.data_revision}</code></dd></div>
        </dl></details>
        <div className="atlas-dialog-actions"><button type="button" className="atlas-button" onClick={() => setDialog('report')}>{text.report}<FilePlus2 size={15} aria-hidden="true" /></button></div>
      </div> : <div className="atlas-dialog-body">
        <fieldset className="atlas-submission-routes"><legend className="sr-only">{text.reportChannel}</legend>{submissionRoutes.map(id =>
          <label key={id} className={channel === id ? 'is-selected' : ''}><input type="radio" name="submission-route" value={id} checked={channel === id} onChange={() => setChannel(id)} /><strong>{channels[id].name}</strong></label>)}</fieldset>
        <section className="atlas-submission-materials" aria-live="polite"><h3>{text.materials}</h3><p>{channels[channel].materials}</p></section>
      </div>}
    </Modal>}
  </>;
}
