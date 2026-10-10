export type Col = { key: string; label: string; type: 'text' | 'num' };
const t = (key: string, label: string): Col => ({ key, label, type: 'text' });
const n = (key: string, label: string): Col => ({ key, label, type: 'num' });

export const COLS: Col[] = [
  t('query_id', 'Query ID'), t('start_time', 'Start Time'), t('sql_statement', 'SQL'),
  t('query_status', 'Query Status'), t('executor_group', 'Executor Group'),
  t('admission_result', 'Admission Result'), t('exec_option', 'Exec Option'),
  t('per_node_memory', 'Per Node Memory'),
  n('mem_limit_mb', 'Mem Limit (MB)'), n('cluster_mem_admitted_mb', 'Cluster Mem Admitted (MB)'),
  n('peak_memory_usage_mb', 'Peak Memory Usage (MB)'), n('per_host_peak_mem_usage_mb', 'Per Host Peak Mem (MB)'),
  n('data_cache_hit_bytes_mb', 'Cache Hit (MB)'), n('data_cache_miss_bytes_mb', 'Cache Miss (MB)'),
  n('data_cache_hit_count', 'Cache Hit Count'), n('data_cache_miss_count', 'Cache Miss Count'),
  n('scratch_bytes_written_mb', 'Scratch Written (MB)'), n('scratch_file_used_bytes_mb', 'Scratch File Used (MB)'),
  n('scratch_writes', 'Scratch Writes'), n('scratch_bytes_read_mb', 'Scratch Read (MB)'),
  n('peak_unpinned_bytes_mb', 'Peak Unpinned (MB)'), n('write_io_bytes_mb', 'Write IO (MB)'),
  n('write_io_ops', 'Write IO Ops'), n('peak_reservation_mb', 'Peak Reservation (MB)'),
  n('reservation_limit_mb', 'Reservation Limit (MB)'),
];
export const CLUSTER_COL: Col = t('cluster', 'Cluster');
export const DEFAULT_VISIBLE = [
  'cluster', 'query_id', 'start_time', 'query_status', 'executor_group', 'mem_limit_mb',
  'peak_memory_usage_mb', 'scratch_bytes_written_mb', 'data_cache_hit_bytes_mb',
  'data_cache_miss_bytes_mb', 'exec_option', 'sql_statement',
];
export const CATEGORICAL = ['cluster', 'query_status', 'executor_group', 'admission_result', 'exec_option'];

export function labelOf(k: string): string {
  if (k === 'cluster') return 'Cluster';
  if (k.startsWith('summary.')) return k.slice(8);
  if (k.startsWith('counter.')) return k.slice(8) + ' (counter)';
  return COLS.find((c) => c.key === k)?.label || k;
}
export function typeOf(k: string): 'text' | 'num' {
  if (k.startsWith('counter.')) return 'num';
  if (k.startsWith('summary.') || k === 'cluster') return 'text';
  return COLS.find((c) => c.key === k)?.type || 'text';
}
