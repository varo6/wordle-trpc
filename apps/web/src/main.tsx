import { RouterProvider, createRouter } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, trpc } from "./utils/trpc";

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingComponent: () => <Loader />,
  context: { trpc, queryClient },
  Wrap: function WrapComponent({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Root element not found");
}

const isPwaEnabled = import.meta.env.VITE_ENABLE_PWA === "true";

if (!isPwaEnabled && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    })
    .catch(() => {
      /* no-op */
    });

  if ("caches" in window) {
    caches
      .keys()
      .then((keys) => {
        keys.forEach((key) => caches.delete(key));
      })
      .catch(() => {
        /* no-op */
      });
  }
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<RouterProvider router={router} />);
}
