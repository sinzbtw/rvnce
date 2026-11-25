import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
  FileText,
  Globe,
  GripHorizontal,
  Link,
  Monitor,
  Moon,
  Palette,
  PanelRight,
  Plus,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-preact'

const icons = {
  upload: Upload,
  download: Download,
  file: FileText,
  monitor: Monitor,
  panel: PanelRight,
  person: UserRound,
  link: Link,
  palette: Palette,
  grip: GripHorizontal,
  close: X,
  settings: SlidersHorizontal,
  globe: Globe,
  phone: Smartphone,
  external: ExternalLink,
  plus: Plus,
  up: ChevronUp,
  down: ChevronDown,
  right: ChevronRight,
  remove: Trash2,
  sun: Sun,
  moon: Moon,
}

export function Icon({ name }: { name: keyof typeof icons }) {
  const Glyph = icons[name]
  return <Glyph aria-hidden="true" class="icon" size={18} strokeWidth={1.7} />
}
