export { cn } from "./lib/utils";
export { Sidebar } from "./components/Sidebar";
export type { SidebarItem } from "./components/Sidebar";
export { Button, buttonVariants } from "./components/Button";
export { Input } from "./components/Input";
export { Label } from "./components/Label";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/Card";
export { Badge, badgeVariants } from "./components/Badge";
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/Dialog";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/Select";
export { Avatar, AvatarImage, AvatarFallback } from "./components/Avatar";
export { Separator } from "./components/Separator";
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "./components/Breadcrumb";
export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from "./components/Toast.js";
export { Toaster } from "./components/Toaster.js";
export { useToast, addToast, dismissToast } from "./hooks/useToast.js";
export type { Toast as ToastType, ToastVariant } from "./hooks/useToast.js";
export { EmptyState } from "./components/EmptyState.js";
export { Textarea } from "./components/Textarea.js";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/Tabs.js";
export { Switch } from "./components/Switch.js";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuPortal,
} from "./components/DropdownMenu.js";
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./components/Tooltip.js";
export { PageHeader } from "./components/PageHeader.js";
export { Kbd } from "./components/Kbd.js";
export { AppShell } from "./components/AppShell.js";
export { SidebarPanel } from "./components/SidebarPanel.js";
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./components/Table.js";
export { CodeBlock } from "./components/CodeBlock.js";
export { SectionLabel } from "./components/SectionLabel.js";
export { IconBadge } from "./components/IconBadge.js";
export { InlineCode } from "./components/InlineCode.js";
export { IconRail } from "./components/IconRail.js";
export type { IconRailItem } from "./components/IconRail.js";
export {
  CommandPalette,
  CommandPaletteGroup,
  CommandPaletteItem,
  CommandPaletteEmpty,
} from "./components/CommandPalette.js";
export { useCommandPalette } from "./hooks/useCommandPalette.js";

// Curated Lucide icon re-exports
export {
  Search,
  Home,
  LayoutDashboard,
  CheckSquare,
  Users,
  Calendar,
  BookOpen,
  FileText,
  Link2,
  Bot,
  Settings,
  Shield,
  ShieldCheck,
  Mic,
  Camera,
  Video,
  Sparkles,
  Loader2,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  PanelLeft,
  Plus,
  X,
  LogOut,
  Pencil,
  Zap,
  Radio,
  Volume2,
  VolumeX,
  CheckCircle,
  MessageSquare,
  HardDrive,
  Github,
  Download,
  Briefcase,
  Check,
  MoreHorizontal,
  Trash2,
  Edit3,
  Eye,
  Clock,
  Star,
  Hash,
  Globe,
  Mail,
  Phone,
  Building2,
  DollarSign,
  BarChart3,
  Activity,
  Lock,
  Inbox,
  Copy,
  ChevronDown,
  ChevronUp,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Code2,
  Square,
  Circle,
  Send,
  Pin,
  PinOff,
  EyeOff,
  GripHorizontal,
  MicOff,
  Pause,
  Play,
  Bookmark,
  Flag,
  ExternalLink,
  PenLine,
} from "lucide-react";
