import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import ConnectPlugin from "./ConnectPlugin";

const app = createApp(App);

app.use(router);
app.use(ConnectPlugin);

app.mount("#app");
