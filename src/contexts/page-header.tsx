import {
  createContext,
  useContext,
  useState,
  useLayoutEffect,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

interface PageHeaderCtx {
  title: string
  setTitle: (t: string) => void
  actionsContainer: HTMLElement | null
  setActionsContainer: (el: HTMLElement | null) => void
  breadcrumbContainer: HTMLElement | null
  setBreadcrumbContainer: (el: HTMLElement | null) => void
  titleSlotInUse: boolean
  setTitleSlotInUse: (v: boolean) => void
  titleSlotContainer: HTMLElement | null
  setTitleSlotContainer: (el: HTMLElement | null) => void
}

const PageHeaderContext = createContext<PageHeaderCtx>({
  title: "",
  setTitle: () => {},
  actionsContainer: null,
  setActionsContainer: () => {},
  breadcrumbContainer: null,
  setBreadcrumbContainer: () => {},
  titleSlotInUse: false,
  setTitleSlotInUse: () => {},
  titleSlotContainer: null,
  setTitleSlotContainer: () => {},
})

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("")
  const [actionsContainer, setActionsContainer] = useState<HTMLElement | null>(null)
  const [breadcrumbContainer, setBreadcrumbContainer] = useState<HTMLElement | null>(null)
  const [titleSlotInUse, setTitleSlotInUse] = useState(false)
  const [titleSlotContainer, setTitleSlotContainer] = useState<HTMLElement | null>(null)
  return (
    <PageHeaderContext.Provider
      value={{
        title,
        setTitle,
        actionsContainer,
        setActionsContainer,
        breadcrumbContainer,
        setBreadcrumbContainer,
        titleSlotInUse,
        setTitleSlotInUse,
        titleSlotContainer,
        setTitleSlotContainer,
      }}
    >
      {children}
    </PageHeaderContext.Provider>
  )
}

/**
 * Call this at the top of any page component to register a title in the
 * layout's sticky header. Uses useLayoutEffect so the title is painted on
 * the first frame (no visible flash).
 */
export function usePageTitle(title: string) {
  const { setTitle } = useContext(PageHeaderContext)
  useLayoutEffect(() => {
    setTitle(title)
    return () => setTitle("")
  }, [title, setTitle])
}

export function usePageHeaderTitle() {
  return useContext(PageHeaderContext).title
}

/**
 * Returns a portal ReactNode that renders `actions` into the layout header's
 * action slot. Render the returned node anywhere in the page component's JSX.
 *
 * This avoids storing ReactNode in context state (which causes infinite
 * re-render loops, since JSX creates new object references every render).
 */
export function usePageHeaderActions(actions: ReactNode): ReactNode {
  const { actionsContainer } = useContext(PageHeaderContext)
  if (!actionsContainer) return null
  return createPortal(actions, actionsContainer)
}

/**
 * Used by the layout header to register itself as the portal mount point.
 */
export function useRegisterActionsContainer(): (el: HTMLElement | null) => void {
  return useContext(PageHeaderContext).setActionsContainer
}

/**
 * Returns a portal ReactNode that renders `breadcrumb` into the layout header's
 * breadcrumb slot. Render the returned node in the page component's JSX.
 */
export function usePageHeaderBreadcrumb(breadcrumb: ReactNode): ReactNode {
  const { breadcrumbContainer } = useContext(PageHeaderContext)
  if (!breadcrumbContainer) return null
  return createPortal(breadcrumb, breadcrumbContainer)
}

/**
 * Used by the layout header to register the breadcrumb mount point.
 */
export function useRegisterBreadcrumbContainer(): (el: HTMLElement | null) => void {
  return useContext(PageHeaderContext).setBreadcrumbContainer
}

/**
 * Used by the layout header to register the title slot mount point.
 */
export function useRegisterTitleSlotContainer(): (el: HTMLElement | null) => void {
  return useContext(PageHeaderContext).setTitleSlotContainer
}

/**
 * Returns a portal ReactNode that renders `content` into the layout header's
 * title slot, replacing the default title span. Call setTitleSlotInUse so
 * the layout knows to show the slot instead of the title.
 *
 * Use this when a page needs custom title content (e.g. an editable input).
 */
export function usePageHeaderTitleSlot(content: ReactNode): ReactNode {
  const {
    titleSlotContainer,
    setTitleSlotInUse,
  } = useContext(PageHeaderContext)
  useLayoutEffect(() => {
    setTitleSlotInUse(true)
    return () => setTitleSlotInUse(false)
  }, [setTitleSlotInUse])
  if (!titleSlotContainer) return null
  return createPortal(content, titleSlotContainer)
}

export function useTitleSlotInUse(): boolean {
  return useContext(PageHeaderContext).titleSlotInUse
}
