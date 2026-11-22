type P = { size?: number; style?: React.CSSProperties };
const S = (size: number, children: React.ReactNode, style?: React.CSSProperties, fill = false, sw = 1.75) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">{children}</svg>
);

export const PlayIcon = ({ size = 14, style }: P) => S(size, <path d="M6 4l14 8-14 8z" />, { marginLeft: size / 7, ...style }, true);
export const PauseIcon = ({ size = 14, style }: P) => S(size, <><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></>, style, true);
export const RefreshIcon = ({ size = 18 }: P) => S(size, <><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>);
export const DownloadIcon = ({ size = 18 }: P) => S(size, <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>);
export const CheckIcon = ({ size = 12 }: P) => S(size, <polyline points="20 6 9 17 4 12" />, undefined, false, 3);
export const GripIcon = ({ size = 14 }: P) => S(size, <>{[5, 12, 19].flatMap(y => [9, 15].map(x => <circle key={x + '-' + y} cx={x} cy={y} r="1.6" />))}</>, undefined, true);
export const EditIcon = ({ size = 16 }: P) => S(size, <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />);
export const TrashIcon = ({ size = 16 }: P) => S(size, <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>);
export const ChevronDown = ({ size = 18 }: P) => S(size, <polyline points="6 9 12 15 18 9" />);
export const QueueIcon = ({ size = 20 }: P) => S(size, <><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="13" y2="18" /></>);
export const RssIcon = ({ size = 20 }: P) => S(size, <><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></>);
export const TrayIcon = ({ size = 20 }: P) => S(size, <><line x1="22" y1="12" x2="2" y2="12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /><line x1="6" y1="16" x2="6.01" y2="16" /></>);

export const Fwd15 = ({ size = 24, sw = 1.6 }: P & { sw?: number }) => (
  <span className="skip">
    {S(size, <><polyline points="21 3 21 9 15 9" /><path d="M20.5 15a9 9 0 1 1-2.1-9.4L21 9" /></>, undefined, false, sw)}
    <span className="skip-n">15</span>
  </span>
);
export const Back15 = ({ size = 24, sw = 1.6 }: P & { sw?: number }) => (
  <span className="skip">
    {S(size, <><polyline points="3 3 3 9 9 9" /><path d="M3.5 15a9 9 0 1 0 2.1-9.4L3 9" /></>, undefined, false, sw)}
    <span className="skip-n">15</span>
  </span>
);
