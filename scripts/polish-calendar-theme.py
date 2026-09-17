from pathlib import Path

proto = Path('src/Prototype.tsx')
s = proto.read_text()
old = 'className={cx(activeDate===key&&"active",date.getMonth()!==calendarMonth.getMonth()&&"outside")}'
new = 'className={cx(activeDate===key&&"active",localDateKey(today)===key&&"today",date.getMonth()!==calendarMonth.getMonth()&&"outside")}'
if old in s:
    s = s.replace(old, new, 1)
elif 'localDateKey(today)===key&&"today"' not in s:
    raise SystemExit('calendar class anchor missing')
proto.write_text(s)

css = Path('src/operations-workspace.css')
c = css.read_text()
marker = '/* ONE PRO CALENDAR + DATE CONTROL POLISH V2 */'
if marker not in c:
    c += r'''

/* ONE PRO CALENDAR + DATE CONTROL POLISH V2 */
.screen-agenda .agenda-calendar-shell{width:min(100%,900px);max-width:900px;margin:0 0 18px;padding:0;border:1px solid var(--line);border-radius:20px;background:var(--surface);overflow:hidden}
.screen-agenda .calendar-head{display:grid;grid-template-columns:40px minmax(0,1fr) 40px;align-items:center;gap:8px;margin:0;padding:13px 14px;border:0;border-bottom:1px solid var(--line);border-radius:0;background:var(--surface)}
.screen-agenda .calendar-head strong{min-width:0;text-align:center;color:var(--text);font-size:14px;font-weight:850;letter-spacing:-.35px;text-transform:capitalize}
.screen-agenda .calendar-head .icon-button{width:36px;height:36px;border:1px solid var(--line);border-radius:11px;background:var(--surface-2);color:var(--text);font-size:20px;font-weight:500;box-shadow:none;transition:border-color .16s ease,background .16s ease,transform .16s ease}
.screen-agenda .calendar-head .icon-button:hover{border-color:color-mix(in srgb,var(--purple-2) 34%,var(--line));background:color-mix(in srgb,var(--purple-2) 7%,var(--surface));transform:translateY(-1px)}
.screen-agenda .month-calendar{margin:0;padding:0;border:0;border-radius:0;background:var(--surface)}
.screen-agenda .calendar-weekdays{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:0;padding:0 8px;background:var(--surface-2);border-bottom:1px solid var(--line)}
.screen-agenda .calendar-weekdays span{padding:9px 2px;text-align:center;color:var(--muted);font-size:8px;font-weight:850;letter-spacing:.45px;text-transform:uppercase}
.screen-agenda .calendar-weekdays span:first-child{color:color-mix(in srgb,var(--danger) 76%,var(--muted))}
.screen-agenda .calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:0;padding:0}
.screen-agenda .calendar-grid>button{position:relative;min-width:0;min-height:82px;display:grid;grid-template-rows:auto 1fr;align-content:start;justify-items:stretch;gap:6px;padding:8px;border:0;border-right:1px solid var(--line);border-bottom:1px solid var(--line);border-radius:0;background:var(--surface);color:var(--text);text-align:left;overflow:hidden;transition:background .16s ease,box-shadow .16s ease}
.screen-agenda .calendar-grid>button:nth-child(7n){border-right:0}
.screen-agenda .calendar-grid>button:nth-last-child(-n+7){border-bottom:0}
.screen-agenda .calendar-grid>button:hover{background:color-mix(in srgb,var(--purple-2) 4%,var(--surface))}
.screen-agenda .calendar-grid>button.outside{opacity:.36;background:color-mix(in srgb,var(--surface-2) 42%,var(--surface))}
.screen-agenda .calendar-grid>button.active{z-index:1;background:color-mix(in srgb,var(--purple-2) 6%,var(--surface));box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--purple-2) 68%,var(--blue))}
.screen-agenda .calendar-date-number{width:28px;height:28px;display:grid;place-items:center;border-radius:9px;color:var(--text);font-size:10px;font-weight:850;line-height:1}
.screen-agenda .calendar-grid>button:nth-child(7n+1) .calendar-date-number{color:color-mix(in srgb,var(--danger) 80%,var(--text))}
.screen-agenda .calendar-grid>button.today:not(.active) .calendar-date-number{color:var(--purple-2);background:color-mix(in srgb,var(--purple-2) 11%,var(--surface));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--purple-2) 24%,var(--line))}
.screen-agenda .calendar-grid>button.active .calendar-date-number{color:#fff;background:linear-gradient(135deg,var(--purple-2),var(--blue));box-shadow:0 5px 12px color-mix(in srgb,var(--blue) 20%,transparent)}
.screen-agenda .calendar-agenda-preview{width:100%;display:grid;align-content:start;gap:3px;text-align:left}
.screen-agenda .calendar-agenda-preview em{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 6px;border:1px solid color-mix(in srgb,var(--blue) 13%,var(--line));border-radius:7px;color:var(--blue);background:color-mix(in srgb,var(--blue) 7%,var(--surface));font-size:7px;font-style:normal;font-weight:800;line-height:1.15}
.screen-agenda .calendar-agenda-preview em:nth-of-type(2){color:var(--purple-2);border-color:color-mix(in srgb,var(--purple-2) 13%,var(--line));background:color-mix(in srgb,var(--purple-2) 7%,var(--surface))}
.screen-agenda .calendar-agenda-preview small{padding-left:2px;color:var(--muted);font-size:7px;font-weight:750}
.screen-agenda .calendar-grid>button.active .calendar-agenda-preview em{color:var(--text);background:var(--surface);border-color:color-mix(in srgb,var(--purple-2) 20%,var(--line))}
.screen-agenda .calendar-grid>button.active .calendar-agenda-preview small{color:var(--muted)}

.month-input{display:grid;grid-template-columns:auto minmax(150px,190px);align-items:center;gap:9px;padding:5px 6px 5px 11px;border:1px solid var(--line);border-radius:13px;background:var(--surface)}
.month-input>span{color:var(--muted);font-size:9px;font-weight:800}
.month-input input,.one-pro-shell input[type="date"],.one-pro-shell input[type="month"],.one-pro-shell input[type="time"]{min-height:40px;border:1px solid var(--line)!important;border-radius:10px!important;padding:0 10px!important;color:var(--text)!important;background:var(--surface-2)!important;outline:none!important;box-shadow:none!important}
.one-pro-shell input[type="date"]:focus,.one-pro-shell input[type="month"]:focus,.one-pro-shell input[type="time"]:focus{border-color:var(--purple-2)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--purple-2) 13%,transparent)!important}
.one-pro-shell input[type="date"],.one-pro-shell input[type="month"],.one-pro-shell input[type="time"]{color-scheme:light}
.one-pro-shell.is-dark input[type="date"],.one-pro-shell.is-dark input[type="month"],.one-pro-shell.is-dark input[type="time"]{color-scheme:dark}
.one-pro-shell input[type="date"]::-webkit-calendar-picker-indicator,.one-pro-shell input[type="month"]::-webkit-calendar-picker-indicator,.one-pro-shell input[type="time"]::-webkit-calendar-picker-indicator{cursor:pointer;opacity:.72}

@media(max-width:760px){
  .screen-agenda .agenda-calendar-shell{border-radius:16px}
  .screen-agenda .calendar-head{padding:10px 10px}
  .screen-agenda .calendar-head strong{font-size:12px}
  .screen-agenda .calendar-weekdays{padding:0 4px}
  .screen-agenda .calendar-weekdays span{padding:7px 1px;font-size:7px;letter-spacing:.2px}
  .screen-agenda .calendar-grid>button{min-height:58px;gap:3px;padding:5px 4px}
  .screen-agenda .calendar-date-number{width:23px;height:23px;border-radius:7px;font-size:8px}
  .screen-agenda .calendar-agenda-preview em{padding:2px 3px;border-radius:5px;font-size:5.8px}
  .screen-agenda .calendar-agenda-preview em:nth-of-type(n+2){display:none}
  .screen-agenda .calendar-agenda-preview small{font-size:5.8px}
  .month-input{grid-template-columns:auto minmax(128px,1fr);width:100%;max-width:250px}
}
'''
    css.write_text(c)

agents = Path('AGENTS.md')
a = agents.read_text()
line = '- Calendar visual language uses a restrained surface card, soft selected-cell tint, gradient only on the selected date number, compact agenda chips, and fully themed date/month/time controls; avoid full-cell gradients or native gray browser controls.\n'
if line not in a:
    heading = '## Class database, attendance recap, and report-template decisions — 2026-09-17\n'
    if heading in a:
        idx = a.index(heading) + len(heading)
        a = a[:idx] + '\n' + line + a[idx:]
    else:
        a += '\n' + line
    agents.write_text(a)
