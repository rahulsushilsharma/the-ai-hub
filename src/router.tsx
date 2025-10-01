import { Route, Routes } from "react-router";
import App from "./App";
import Chat from "./pages/Chat";



function AppRouter() {
  return <>


    <Routes>
      <Route path="/" element={<App />} >
        <Route path="/" element={<h1>Home </h1>} />
        <Route path="/chat" element={<Chat />} />
        <Route path="*" element={<div>404 Not Found</div>} />
      </Route>
    </Routes>

  </>
}

export default AppRouter;