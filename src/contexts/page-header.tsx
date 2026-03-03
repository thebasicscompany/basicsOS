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
}

const PageHeaderContext = createContext<PageHeaderCtx>({
  title: "",
  setTitle: () => {},
  actionsContainer: null,
  setActionsContainer: () => {},
})

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("")
  const [actionsContainer, setActionsContainer] = useState<HTMLElement | null>(null)
  return (
    <PageHeaderContext.Provider value={{ title, setTitle, actionsContainer, setActionsContainer }}>
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
