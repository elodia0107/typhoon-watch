# 数据接入与 GitHub Pages

本版本从 https://typhoon.slt.zj.gov.cn/ 的 `Api/TyphoonList/{year}` 和 `Api/TyphoonInfo/{tfid}` 读取真实数据；无活跃台风时仅展示历史记录。地方官方预警尚未接入，原演示预警已移除。公开端点并非有服务承诺的开放 API，再分发条件需向来源方确认。

## 本地预览

需要 Python 3.10+，无第三方依赖。在本仓库运行：

```powershell
python scripts/fetch_typhoons.py
python -m http.server 8080
```

浏览器访问 http://localhost:8080 ，不要通过 file:// 打开。页面每5分钟检查快照，快照超过45分钟或活跃观测超过6小时会提示核对官方信息。轨迹图使用真实坐标，无地理底图。源站风速单位米/秒，移动速度公里/小时，时间为北京时间。

## 部署

完成 `gh auth login` 后运行（将 OWNER 替换为实际账号）：

```powershell
gh repo create typhoon-watch --public --source . --remote origin --push
gh api --method POST repos/OWNER/typhoon-watch/pages -f build_type=workflow
gh workflow run pages.yml
```

已有仓库时使用现有远程地址，避免重复创建。在 Settings → Pages 确认 Source 为 GitHub Actions。首次推送若因 Pages 尚未启用失败，启用后重新运行工作流。

`.github/workflows/pages.yml` 在 push main、手动触发，以及 UTC 每小时7、22、37、52分钟运行。GitHub 定时任务可能延迟或丢弃，公开仓库长期无活动时可能停用，不能当作应急通知系统。

抓取失败会使工作流失败并保留已发布版本；成功后只上传 index.html、app.js 和 data/typhoons.json 到 Pages。数据随 artifact 发布，不每15分钟写入 main。权限为 contents read、pages write、id-token write，不需要额外的数据服务密钥。

只有 Actions 和 Pages 部署成功并验证部署网址后才算上线。本地工作流文件并不代表远程任务已启用。

## 验证

```powershell
python -m unittest discover -s tests
node --check app.js
```
