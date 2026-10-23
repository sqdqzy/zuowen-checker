import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5180,
    // 绑定所有网卡：桌面 localhost 预览 + 安卓模拟器经局域网/10.0.2.2 访问
    host: true
  }
});
