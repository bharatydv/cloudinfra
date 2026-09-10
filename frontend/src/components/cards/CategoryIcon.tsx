import {
  BarChart3,
  Book,
  BookOpen,
  BrainCircuit,
  Briefcase,
  Cloud,
  ClipboardCheck,
  Database,
  Infinity as InfinityIcon,
  LineChart,
  Map as MapIcon,
  Megaphone,
  MessagesSquare,
  Award,
  type LucideIcon,
} from 'lucide-react'

/**
 * Maps a category slug or stored icon name onto a professional icon, so
 * categories render consistently without shipping images.
 */
const ICONS: Record<string, LucideIcon> = {
  'cloud-computing': Cloud,
  cloud: Cloud,
  'artificial-intelligence': BrainCircuit,
  'brain-circuit': BrainCircuit,
  'machine-learning': LineChart,
  'line-chart': LineChart,
  'data-science': Database,
  database: Database,
  devops: InfinityIcon,
  infinity: InfinityIcon,
  'digital-marketing': Megaphone,
  megaphone: Megaphone,
  career: Briefcase,
  briefcase: Briefcase,
  'interview-preparation': MessagesSquare,
  'messages-square': MessagesSquare,
  'exam-preparation': ClipboardCheck,
  'clipboard-check': ClipboardCheck,
  'learning-roadmaps': MapIcon,
  map: MapIcon,
  'certification-guides': Award,
  award: Award,
  analytics: BarChart3,
  'book-open': BookOpen,
  book: Book,
}

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? BookOpen
  return <Icon className={className} aria-hidden="true" />
}
