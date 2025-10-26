import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router";
import App from "./App";
import Home from "./pages/Home";

const Chat = lazy(() => import("./pages/Chat"));
const TtsDemo = lazy(() => import("./pages/TtsDemo"));

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
        path: "*",
        element: <Home />,
      },
    ],
  },
];

function PageLoader({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>;
}

function AppRouter() {
  return (
    <>
      <Routes>
        {routes.map((route, index) => {
          const { path, element, children } = route;
          return (
            <Route
              key={index}
              path={path}
              element={<PageLoader>{element}</PageLoader>}
            >
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
