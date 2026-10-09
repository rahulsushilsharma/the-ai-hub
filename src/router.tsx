import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import App from "./App";

const Home = lazy(() => import("./pages/Home"));
const Chat = lazy(() => import("./pages/Chat"));
const TtsDemo = lazy(() => import("./pages/TtsDemo"));
const HuggingfaceChat = lazy(() => import("./pages/HuggingfaceChat"));
const BgRemover = lazy(() => import("./pages/BgRemover"));
const Agate = lazy(() => import("./pages/Agate"));
const Privacy = lazy(() => import("./pages/Privacy"));
const NotFound = lazy(() => import("./pages/NotFound"));

const routes = [
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/chat",
        element: <Chat />,
      },
      {
        path: "/tts-demo",
        element: <TtsDemo />,
      },
      {
        path: "huggingface-chat",
        element: <HuggingfaceChat />,
      },
      {
        path: "bg-remover",
        element: <BgRemover />,
      },
      {
        path: "agate",
        element: <Agate />,
      },
      {
        path: "privacy",
        element: <Privacy />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
];

function PageLoader({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div role="status" className="p-8 pt-24 font-mono text-sm text-muted-foreground">Loading…</div>}>{children}</Suspense>;
}

function AppRouter() {
  return (
    <>
      <Routes>
        {routes.map((route, index) => {
          const { path, element, children } = route;
          return (
            <Route key={index} path={path} element={element}>
              {children?.map((child, index) => (
                <Route
                  key={index}
                  path={child.path}
                  element={<PageLoader>{child.element}</PageLoader>}
                />
              ))}
            </Route>
          );
        })}
      </Routes>
    </>
  );
}

export default AppRouter;
