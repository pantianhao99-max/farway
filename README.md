# Faraway · 远方

现实步行驱动的冒险远征原型。当前版本包含 100 KM 的绘本世界「雾境远征」和真实世界路线「麦理浩径」。两条路线拥有独立进度，可通过开发模式下的 Mock 距离完整体验结算、地图推进、地点发现、章节揭示与旅途图鉴。

## 运行

```bash
npm install
npm run dev:h5
```

开发预览地址为 `http://localhost:5180/#/`。

H5 生产构建：

```bash
npm run build:h5
```

类型检查：

```bash
npm run type-check
```

开发环境默认显示右下角 `DEV` 面板，可模拟 `+1 / +3 / +5 / +10 KM` 或重置旅程。正式构建默认隐藏；如需在其他模式启用，设置 `VITE_APP_DEBUG=true`。

世界数据与核心边界验证：`npm run test:logic`。

## 结构

- `src/data/worlds/`：雾境远征与麦理浩径的完整章节、路线和地点数据。
- `src/services/journey/`：结算、进度、地点解析和世界仓库，不依赖页面。
- `src/services/health/`：健康数据接口和 Mock 实现，供未来替换 Apple Health provider。
- `src/stores/journey.ts`：动画事件编排与持久化状态。
- `src/pages/`：旅程、世界、我的三个 Tab。

进度通过 `uni.setStorageSync` 持久化。项目不包含登录、后端、真实健康数据、GPS、社交、成就或 RPG 系统。
