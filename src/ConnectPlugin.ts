import type { App } from "vue";
import { ConnectComponent } from "./components";

export default {
  install: (app: App) => {
    app.component("ConnectComponent", ConnectComponent);
  },
};

export { ConnectComponent };
