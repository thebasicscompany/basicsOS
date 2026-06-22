import { useRoutes } from "react-router";
import { AutomationListPage } from "./AutomationListPage";
import { AutomationEditorPage } from "./AutomationEditorPage";

export function AutomationsApp() {
  const routes = useRoutes([
    { index: true, element: <AutomationListPage /> },
    { path: "create", element: <AutomationEditorPage /> },
    { path: ":id", element: <AutomationEditorPage /> },
  ]);
  return routes;
}
