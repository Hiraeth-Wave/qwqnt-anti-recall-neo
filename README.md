# QwQNT AntiRecall Neo

![qwqnt-anti-recall-neo](https://socialify.git.ci/Hiraeth-Wave/qwqnt-anti-recall-neo/image?description=1&font=KoHo&language=1&name=1&owner=1&pattern=Solid&theme=Auto)

基于 QwQNT 框架的 QQNT 防撤回插件，改编自 [MoAccelerator/qwqnt-anti-recall](https://github.com/MoAccelerator/qwqnt-anti-recall)。

## 特性

- 反撤回绝大部分消息，可选是否对自己撤回的消息生效。
- 对被撤回的图片尝试补全、重定向到可访问链接。
  - 可选将被撤回的图片复制到插件数据目录的 `images/` 子目录中。
- 支持 Json 与 LevelDB 持久化存储。
- 提供设置页面，可控制大部分功能选项。

## 安装

我们假设你已经安装了 QwQNT。

1. 下载 Release 构建好的 `qwqnt-anti-recall.zip` 插件包。
2. 按 QwQNT 要求将压缩包解压并放入插件目录。
3. 确保以下插件在 QwQNT 中已安装并已启用：
   - [`qwqnt-ipc-interceptor`](https://github.com/qwqnt-community/qwqnt-ipc-interceptor)
   - [`qwqnt-hako`](https://github.com/qwqnt-community/qwqnt-hako)
4. 重启 QwQNT。

## 配置

- **是否将撤回消息存入数据库**
  - 关：只在内存中保存，退出 QQ 后撤回数据丢失。
  - 开：将撤回记录持久化保存到本地，但会占用额外空间。
- **存储格式**
  - Json：存储在 `<data>/qwqnt-anti-recall/qq-recalled-db.json`，可直接打开，方便查阅。
  - LevelDB：存储在 `<data>/qwqnt-anti-recall/qq-recalled-db.ldb`，性能更高。
- **是否将撤回图片保存到数据目录**
  - 开启后，图片会额外复制到 `<data>/qwqnt-anti-recall/images/`，文件名中包含消息 ID 及简化后的原始文件名。
- **Rkey 服务器地址**
  - 插件自带服务器可能挂了，可通过自定义服务器地址来解决。
- **是否反撤回自己的消息**
  - 开启后，自己撤回的消息也会被保留；从下一条新消息开始生效。
- **启用定期清理**
  - 控制内存中的消息缓存大小，可配置：
    - 内存中最多缓存消息条数
    - 每次清理时删除的消息数量
- **样式配置**
  - 撤回高亮主题色（会同时影响阴影和「已撤回」提示文本颜色）
  - 是否显示阴影效果
  - 是否在消息下方显示「已撤回」提示条