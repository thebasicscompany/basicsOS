import {
  createContext,
  useContext,
  useState,
  useLayoutEffect,
  type ReactNode,
} from "react"

interface PageHeaderCtx {
  title: string
  setTitle: (t: string) => void
}

const PageHeaderContext = createContext<PageHeaderCtx>({
  title: "",
  setTitle: () => {},
})

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("")
  return (
    <PageHeaderContext.Provider value={{ title, setTitle }}>
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
