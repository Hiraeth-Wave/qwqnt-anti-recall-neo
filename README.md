# QwQNT AntiRecall Neo

![qwqnt-anti-recall-neo](https://socialify.git.ci/Hiraeth-Wave/qwqnt-anti-recall-neo/image?description=1&font=KoHo&language=1&name=1&owner=1&pattern=Solid&theme=Auto)

基于 QwQNT 框架的 QQNT 防撤回插件，改编自 [MoAccelerator/qwqnt-anti-recall](https://github.com/MoAccelerator/qwqnt-anti-recall)。

## 特性

- 反撤回绝大部分消息，可选是否对自己撤回的消息生效。
- 对被撤回的图片尝试补全、重定向到可访问链接。
- 可使用 Json 或 LevelDB 持久化存储，重启 QQ 数据不丢失。
- 提供设置页面，可控制大部分功能选项。

## 安装

我们假设你已经安装了 QwQNT。

1. 下载 Release 构建好的 `qwqnt-anti-recall-neo.zip` 插件包。
2. 按 QwQNT 要求将压缩包解压并放入插件目录。
3. 确保以下插件在 QwQNT 中已安装并已启用：
   - [`qwqnt-ipc-interceptor`](https://github.com/qwqnt-community/qwqnt-ipc-interceptor)
   - [`qwqnt-hako`](https://github.com/qwqnt-community/qwqnt-hako)
4. 重启 QwQNT。