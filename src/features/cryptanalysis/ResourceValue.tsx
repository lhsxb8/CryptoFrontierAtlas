import { TriangleAlert } from 'lucide-react';
import type { AnalysisResource } from './types';
import { Formula } from './Formula';
import { ResourceUnit } from './ResourceUnit';
import { readerText } from './presentation';
import { resourceExpression, resourceLegend } from './resource-copy';

const resourceLabels: Record<AnalysisResource['status'], string> = {
  reported: 'Reported', qualitative: 'Qualitative', not_reported: 'Not reported', not_applicable: 'Not applicable', conflict: 'Source conflict',
};
const qualifierLabels: Partial<Record<AnalysisResource['qualifier'], string>> = {
  estimate: 'Estimate', upper_bound: 'Upper bound', lower_bound: 'Lower bound', exact: 'Exact',
};

/** Native expressions, units and bound/estimate qualifiers stay visible in every view. */
export function ResourceValue({ resource, expanded = false, display = false }: { resource: AnalysisResource; expanded?: boolean; display?: boolean }) {
  return (
    <div className={`a-resource a-resource-${resource.status}`}>
      {resource.status !== 'reported' && <span className="a-resource-status">{resource.status === 'conflict' && <TriangleAlert size={12} aria-hidden="true" />}{resourceLabels[resource.status]}</span>}
      {resource.reported !== null && <span className="a-expression" data-source-expression={resource.reported}><Formula expression={resourceExpression(resource.reported)} display={display} readable /></span>}
      {resource.unit !== null && <ResourceUnit unit={resource.unit} />}
      {resource.reported && resourceLegend(resource.reported) && <span className="a-resource-legend"><Formula expression={resourceLegend(resource.reported)!} readable /></span>}
      {qualifierLabels[resource.qualifier] && <span className="a-resource-qualifier">{qualifierLabels[resource.qualifier]}</span>}
      {expanded && readerText(resource.note) && <p className="a-resource-note"><Formula expression={readerText(resource.note)} /></p>}
    </div>
  );
}
