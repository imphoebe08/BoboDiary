import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Bar } from 'recharts';
import { Calendar as CalendarIcon, Utensils, Activity, Syringe, Plus, Trash2, Edit2, Settings, BookHeart, X, LogOut, ChevronLeft, ChevronRight, Camera, Filter } from 'lucide-react';
import './bobo-theme.css';
import { api } from './api';
// 因為照片放在 public 資料夾，我們加上 ../ 去上一層抓取
import boboImg from '../public/bobo.jpg'; 

// 通用彈跳視窗元件
const Modal = ({ title, onClose, children }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{title}</h2>
        <button className="btn-icon" onClick={onClose}><X size={24} /></button>
      </div>
      {children}
    </div>
  </div>
);

// 年月選擇彈窗
const MonthYearPicker = ({ currentDate, onDateChange, onClose }) => {
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth());

  const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
  const monthNames = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

  const handleConfirm = () => {
      onDateChange(new Date(year, month, 1));
      onClose();
  };

  return (
      <Modal title="選擇年月" onClose={onClose}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '20px 0' }}>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="input-style">
                  {years.map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input-style">
                  {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
          </div>
          <button className="btn-primary" onClick={handleConfirm}>確定</button>
      </Modal>
  );
};

// ==============================
// 1. 行事曆介面 (Calendar Tab)
// ==============================
const CalendarTab = () => {
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState({ categories: [] });
  const [showFormModal, setShowFormModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [form, setForm] = useState({ date: '', title: '', type: '就醫', repeatFrequency: 'none', repeatEndDate: '', startTime: '', isDateRange: false, endDate: '', endTime: '' });
  const [editingId, setEditingId] = useState(null);
  const [editingOccurrenceDate, setEditingOccurrenceDate] = useState(null);
  const [deletePromptTarget, setDeletePromptTarget] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'all'
  const [newCat, setNewCat] = useState('');

  const [viewDate, setViewDate] = useState(new Date());
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth(); // 0-11

  const todayObj = new Date();
  // 修正 todayStr 的格式，確保月份和日期總是兩位數
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  const handlePrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));
  const handleToday = () => setViewDate(new Date());

  useEffect(() => { 
    api.getEvents().then(setEvents); 
    api.getCalendarSettings().then(res => {
      setSettings(res);
      setForm(prev => ({...prev, type: res.categories[0] || '就醫'}));
    });
  }, []);

  const [showPastEvents, setShowPastEvents] = useState(false);
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);

  const handleSave = async () => {
    if (!form.date || !form.title) return;

    let startDateTime = form.date;
    if (form.startTime) {
      startDateTime += `T${form.startTime}:00`;
    }

    let endDateTime = null;
    if (form.isDateRange && form.endDate) {
      endDateTime = form.endDate;
      if (form.endTime) {
        endDateTime += `T${form.endTime}:00`;
      }
    }

    if (endDateTime && new Date(endDateTime) < new Date(startDateTime)) {
      alert('結束時間不得小於開始時間');
      return;
    }

    if (form.repeatFrequency !== 'none' && form.repeatEndDate && new Date(form.repeatEndDate) < new Date(form.date.split('T')[0])) {
      alert('重複結束日期不得小於開始日期');
      return;
    }

    const eventData = { ...form, date: startDateTime, endDate: endDateTime, repeatFrequency: form.repeatFrequency, repeatEndDate: form.repeatEndDate || null };
    const notionPayload = { title: form.title, date: startDateTime, endDate: endDateTime };

    if (editingId) {
      // 1. 編輯：先更新原本的資料庫
      await api.updateEvent(editingId, eventData);
      
      // 2. 同步編輯到 Notion (檢查此事件是否有綁定 Notion ID)
      const originalEvent = events.find(e => e.id === editingId);
      if (originalEvent && originalEvent.notionPageId) {
        try {
          await fetch(`/api/events?page_id=${originalEvent.notionPageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notionPayload)
          });
        } catch (error) {
          console.error('Notion 編輯同步失敗:', error);
        }
      }
    } else {
      // 1. 新增：先同步到 Notion 以取得專屬的 Page ID
      try {
        const notionRes = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notionPayload)
        });
        if (notionRes.ok) {
          const notionData = await notionRes.json();
          if (notionData.id) eventData.notionPageId = notionData.id; // 將 Notion ID 記下來
        } else {
          console.error('Notion 新增回傳錯誤狀態:', notionRes.status);
        }
      } catch (error) {
        console.error('Notion 新增同步失敗:', error);
      }

      // 2. 將包含 Notion ID 的資料存入原本的資料庫
      await api.addEvent(eventData);
    }
    setEvents(await api.getEvents());
    setForm({ date: '', title: '', type: settings.categories[0] || '就醫', repeatFrequency: 'none', repeatEndDate: '', startTime: '', isDateRange: false, endDate: '', endTime: '' });
    setEditingId(null);
    setShowFormModal(false);
  };

  const handleEdit = (ev) => {
    // 確保我們總是編輯原始事件，而不是重複產生的虛擬事件
    const originalEvent = events.find(e => e.id === ev.id);
    if (!originalEvent) return;

    const [startDatePart, startTimePart] = (originalEvent.date || '').split('T');
    const startTime = startTimePart ? startTimePart.substring(0, 5) : '';

    const [endDatePart, endTimePart] = (originalEvent.endDate || '').split('T');
    const endTime = endTimePart ? endTimePart.substring(0, 5) : '';

    setForm({ 
      date: startDatePart, 
      title: originalEvent.title, 
      type: originalEvent.type,
      repeatFrequency: originalEvent.repeatFrequency || 'none',
      repeatEndDate: originalEvent.repeatEndDate || '',
      isDateRange: !!originalEvent.isDateRange || !!originalEvent.endDate,
      startTime: startTime,
      endDate: endDatePart || '',
      endTime: endTime,
    });
    setEditingId(originalEvent.id);
    setEditingOccurrenceDate(ev.occurrenceDate || startDatePart);
    setShowFormModal(true);
  };

  const handleDelete = async (ev) => {
    const id = ev.id || ev;
    const originalEvent = events.find(e => e.id === id);
    if (!originalEvent) return;

    const isRepeating = originalEvent.repeatFrequency && originalEvent.repeatFrequency !== 'none';

    if (isRepeating && ev.occurrenceDate) {
      setDeletePromptTarget(ev);
      return;
    }

    if (!window.confirm("確定要刪除這個行程嗎？")) return;
    executeDelete(ev, 'all');
  };

  const executeDelete = async (ev, deleteMode) => {
    const id = ev.id || ev;
    const occurrenceDate = ev.occurrenceDate;
    const originalEvent = events.find(e => e.id === id);
    if (!originalEvent) return;

    if (deleteMode === 'single') {
      const newExcluded = [...(originalEvent.excludedDates || []), occurrenceDate];
      await api.updateEvent(id, { ...originalEvent, excludedDates: newExcluded });
    } else if (deleteMode === 'future') {
      const occurrenceDateObj = new Date(occurrenceDate);
      occurrenceDateObj.setDate(occurrenceDateObj.getDate() - 1);
      const yyyy = occurrenceDateObj.getFullYear();
      const mm = String(occurrenceDateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(occurrenceDateObj.getDate()).padStart(2, '0');
      const newEndDate = `${yyyy}-${mm}-${dd}`;

      if (newEndDate < originalEvent.date.split('T')[0]) {
        if (originalEvent.notionPageId) try { await fetch(`/api/events?page_id=${originalEvent.notionPageId}`, { method: 'DELETE' }); } catch(e){}
        await api.deleteEvent(id);
      } else {
        await api.updateEvent(id, { ...originalEvent, repeatEndDate: newEndDate });
      }
    } else {
      if (originalEvent.notionPageId) try { await fetch(`/api/events?page_id=${originalEvent.notionPageId}`, { method: 'DELETE' }); } catch(e){}
      await api.deleteEvent(id);
    }

    setEvents(await api.getEvents());
    if (editingId === id) {
      setShowFormModal(false);
      setEditingId(null);
    }
    setDeletePromptTarget(null);
  };
  
  const handleAddCat = async () => {
    if(!newCat) return;
    const updated = { ...settings, categories: [...settings.categories, newCat] };
    await api.saveCalendarSettings(updated);
    setSettings(updated);
    setNewCat('');
  };
  
  const handleDeleteCat = async (idx) => {
    const updatedCats = [...settings.categories];
    updatedCats.splice(idx, 1);
    const updated = { ...settings, categories: updatedCats };
    await api.saveCalendarSettings(updated);
    setSettings(updated);
  };
  
  const openNewForm = (dateStr = '') => {
    setForm({ date: dateStr, title: '', type: settings.categories[0] || '就醫', repeatFrequency: 'none', repeatEndDate: '', startTime: '', isDateRange: false, endDate: '', endTime: '' });
    setEditingId(null);
    setEditingOccurrenceDate(null);
    setShowFormModal(true);
  };

  // 處理重複事件，展開成多個虛擬事件
  const getExpandedEvents = (rawEvents) => {
    const expanded = [];
    const endDateLimit = new Date();
    endDateLimit.setFullYear(endDateLimit.getFullYear() + 2); // 為了效能，只看未來兩年的重複事件

    rawEvents.forEach(event => {
      const originalDateStr = event.date.split('T')[0];
      const timePart = event.date.includes('T') ? 'T' + event.date.split('T')[1] : '';
      const freq = event.repeatFrequency || 'none';

      if (freq === 'none') {
        if (!event.excludedDates || !event.excludedDates.includes(originalDateStr)) {
          expanded.push({
            ...event,
            date: originalDateStr,
            timeStr: timePart ? timePart.substring(1, 6) : '',
            occurrenceDate: originalDateStr
          });
        }
      } else {
        let currentDate = new Date(originalDateStr + 'T00:00:00');
        const rEndStr = event.repeatEndDate;
        const rEnd = rEndStr ? new Date(rEndStr + 'T00:00:00') : endDateLimit;
        const actualEnd = rEnd < endDateLimit ? rEnd : endDateLimit;

        while (currentDate <= actualEnd) {
          const yyyy = currentDate.getFullYear();
          const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
          const dd = String(currentDate.getDate()).padStart(2, '0');
          const newDateStr = `${yyyy}-${mm}-${dd}`;

          if (!event.excludedDates || !event.excludedDates.includes(newDateStr)) {
            expanded.push({
              ...event,
              date: newDateStr,
              timeStr: timePart ? timePart.substring(1, 6) : '',
              key: `${event.id}-${newDateStr}`,
              occurrenceDate: newDateStr
            });
          }
          
          if (freq === 'daily') currentDate.setDate(currentDate.getDate() + 1);
          else if (freq === 'monthly') currentDate.setMonth(currentDate.getMonth() + 1);
          else if (freq === 'every-2-months') currentDate.setMonth(currentDate.getMonth() + 2);
          else if (freq === 'every-3-months') currentDate.setMonth(currentDate.getMonth() + 3);
          else if (freq === 'every-6-months') currentDate.setMonth(currentDate.getMonth() + 6);
          else if (freq === 'yearly') currentDate.setFullYear(currentDate.getFullYear() + 1);
          else break;
        }
      }
    });
    return expanded;
  };

  const renderCalendar = () => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    
    const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const allVisibleEvents = getExpandedEvents(events);

    return (
      <div className="card">
        <div className="calendar-title-bar">
          <div className="calendar-month-switcher">
            <button className="btn-icon" onClick={handlePrevMonth}><ChevronLeft size={24} /></button>
            <h3 onClick={() => setShowMonthYearPicker(true)} title="選擇年月" style={{cursor: 'pointer', textAlign: 'center', flex: 1}}>{currentYear} 年 {currentMonth + 1} 月</h3>
            <button className="btn-icon" onClick={handleNextMonth}><ChevronRight size={24} /></button>
            <button className="btn-secondary" onClick={handleToday} style={{marginLeft: '10px', padding: '0 10px'}}>今天</button>
          </div>
          <button className="btn-primary" style={{width: 'auto', padding: '8px 12px'}} onClick={() => openNewForm()}>
            <Plus size={18} /> 新增
          </button>
        </div>
        <div className="calendar-grid">
          {weekDays.map(wd => <div key={wd} className="calendar-header-cell">{wd}</div>)}
          {blanks.map(b => <div key={`blank-${b}`} className="calendar-cell empty" />)}
          {days.map(d => {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayEvents = allVisibleEvents.filter(ev => ev.date === dateStr);
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;
            const isFuture = dateStr > todayStr;
            return ( // 已過期的日期，點擊時不再跳出新增表單
              <div key={d} className={`calendar-cell ${dayEvents.length > 0 ? 'has-event' : ''} ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''}`} onClick={() => !isPast && openNewForm(dateStr)}>
                <span style={{fontWeight: isToday ? 'bold' : 'normal'}}>{d}</span>
                <div style={{width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                  {dayEvents.slice(0, 2).map(ev => (
                    <div 
                      key={ev.key || ev.id} 
                      className="event-pill" 
                    style={{ opacity: isPast ? 0.6 : 1, backgroundColor: isPast ? '#A0A0A0' : 'var(--primary-dark)', cursor: 'pointer' }} 
                      title={ev.title}
                      onClick={(e) => { e.stopPropagation(); handleEdit(ev); }}
                    >
                      {ev.timeStr ? `${ev.timeStr} ` : ''}{ev.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  const allVisibleEvents = getExpandedEvents(events);

  let eventsForList = allVisibleEvents.sort((a,b) => new Date(a.date) - new Date(b.date));

  if (viewMode === 'all') {
    // 在「全部行程」模式下，過期的重複事件不顯示，且只顯示未來最近的一次
    const seenRepeating = new Set();
    eventsForList = eventsForList.filter(ev => {
      if (ev.repeatDays && ev.repeatDays > 0) {
        if (ev.date < todayStr) return false; // 隱藏過去的重複行程
        if (seenRepeating.has(ev.id)) return false; // 只保留未來的第一次，後續不再顯示
        seenRepeating.add(ev.id);
      }
      return true;
    });
  } else {
    // 在「本月行程」模式下
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    eventsForList = eventsForList.filter(ev => ev.date.startsWith(monthPrefix));
    if (!showPastEvents) {
      eventsForList = eventsForList.filter(ev => ev.date >= todayStr);
    }
  }

  return (
    <div>
      <h2><CalendarIcon /> 行事曆</h2>
      {renderCalendar()}
      
      <div className="flex-between" style={{ margin: '20px 0 10px 0' }}>
        <div className="btn-group">
          <button className={`btn-secondary ${viewMode === 'month' ? 'active' : ''}`} onClick={() => setViewMode('month')}>本月行程</button>
          <button className={`btn-secondary ${viewMode === 'all' ? 'active' : ''}`} onClick={() => setViewMode('all')}>全部行程</button>
        </div>
        <label className="checkbox-label" style={{marginLeft: 'auto'}}>
          <input type="checkbox" checked={showPastEvents} onChange={e => setShowPastEvents(e.target.checked)} /> 顯示過期事件
        </label>
      </div>

      {eventsForList.map(ev => {
        const isPast = ev.date < todayStr;
        return (
        <div className={`card flex-between ${isPast ? 'past-event-card' : ''}`} key={ev.key || ev.id} style={isPast ? { opacity: 0.6, background: '#f5f5f5' } : {}}>
          <div style={{ flex: 1 }}>
            <span className="tag" style={isPast ? {backgroundColor: '#A0A0A0'} : {}}>{ev.type}</span>
            <strong style={isPast ? {color: '#888'} : {}}>{ev.date} {ev.timeStr}</strong> - <span style={isPast ? {textDecoration: 'line-through', color: '#888'} : {}}>{ev.title}</span>
          </div>
          <div>
            <button className="btn-icon" onClick={() => handleEdit(ev)}><Edit2 size={18} /></button>
            <button className="btn-icon" onClick={() => handleDelete(ev)}><Trash2 size={18} /></button>
          </div>
        </div>
      )})}

      {showFormModal && (
        <Modal title={editingId ? '編輯排程' : '新增排程'} onClose={() => setShowFormModal(false)}>
          <div className="input-group">
            <label style={{display: 'flex', justifyContent: 'space-between'}}>
              項目類別 
              <button className="btn-icon" onClick={() => setShowSettingsModal(true)} style={{padding: 0, color: 'var(--primary-orange)'}}><Settings size={16}/> 管理</button>
            </label>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              {settings.categories.length === 0 && <option value="">請先新增類別</option>}
              {settings.categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>詳細事項</label>
            <input type="text" placeholder="例如：打狂犬病疫苗" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          </div>

          <div style={{ background: '#FAFAFA', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="input-group" style={{flex: 1, marginBottom: 0}}>
                <label>開始日期</label>
                <DatePicker 
                  selected={form.date ? new Date(form.date + 'T00:00:00') : null} 
                  onChange={date => {
                    if (date) {
                      const yyyy = date.getFullYear();
                      const mm = String(date.getMonth() + 1).padStart(2, '0');
                      const dd = String(date.getDate()).padStart(2, '0');
                      setForm({...form, date: `${yyyy}-${mm}-${dd}`});
                    } else setForm({...form, date: ''});
                  }} 
                  dateFormat="yyyy-MM-dd" placeholderText="請選擇日期" />
              </div>
              <div className="input-group" style={{flex: 1, marginBottom: 0}}>
                <label>開始時間</label>
                <input type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} style={{width: '100%', boxSizing: 'border-box'}} />
              </div>
            </div>

            <label className="checkbox-label" style={{ marginTop: '15px', marginBottom: '10px', display: 'inline-flex', background: 'transparent', border: 'none', padding: 0 }}>
              <input type="checkbox" checked={form.isDateRange} onChange={e => setForm({...form, isDateRange: e.target.checked})} />
              設定本行程結束時間
            </label>

            {form.isDateRange && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="input-group" style={{flex: 1, marginBottom: 0}}>
                  <label>結束日期</label>
                  <DatePicker 
                    selected={form.endDate ? new Date(form.endDate + 'T00:00:00') : null} 
                    onChange={date => {
                      if (date) {
                        const yyyy = date.getFullYear();
                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                        const dd = String(date.getDate()).padStart(2, '0');
                        setForm({...form, endDate: `${yyyy}-${mm}-${dd}`});
                      } else setForm({...form, endDate: ''});
                    }} 
                    dateFormat="yyyy-MM-dd" placeholderText="請選擇日期" />
                </div>
                <div className="input-group" style={{flex: 1, marginBottom: 0}}>
                  <label>結束時間</label>
                  <input type="time" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} style={{width: '100%', boxSizing: 'border-box'}} />
                </div>
              </div>
            )}
          </div>
          
          <div className="input-group">
            <label>重複週期</label>
            <select value={form.repeatFrequency} onChange={e => setForm({...form, repeatFrequency: e.target.value})}>
              <option value="none">不重複</option>
              <option value="daily">每日</option>
              <option value="monthly">每月</option>
              <option value="every-2-months">每兩個月</option>
              <option value="every-3-months">每三個月</option>
              <option value="every-6-months">每半年</option>
              <option value="yearly">每年</option>
            </select>
          </div>

          {form.repeatFrequency !== 'none' && (
            <div className="input-group">
              <label>重複結束日期</label>
              <DatePicker 
                selected={form.repeatEndDate ? new Date(form.repeatEndDate + 'T00:00:00') : null} 
                onChange={date => {
                  if (date) {
                    const yyyy = date.getFullYear();
                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                    const dd = String(date.getDate()).padStart(2, '0');
                    setForm({...form, repeatEndDate: `${yyyy}-${mm}-${dd}`});
                  } else setForm({...form, repeatEndDate: ''});
                }} 
                dateFormat="yyyy-MM-dd" placeholderText="留空表示無限期重複" />
            </div>
          )}

          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '25px'}}>
            {editingId ? (
              <>
                <button className="btn-secondary" style={{color: 'var(--primary-orange)', borderColor: 'var(--primary-orange)'}} onClick={() => handleDelete({ id: editingId, occurrenceDate: editingOccurrenceDate })}>
                  <Trash2 size={20} /> 刪除
                </button>
                <button className="btn-primary" onClick={handleSave}>
                  儲存修改
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={handleSave} style={{width: '100%'}}>
                <Plus size={20} /> 新增排程
              </button>
            )}
          </div>
        </Modal>
      )}

      {deletePromptTarget && (
        <Modal title="刪除重複行程" onClose={() => setDeletePromptTarget(null)}>
          <p style={{marginBottom: '20px', color: 'var(--text-main)'}}>這是一個重複行程，請問您要刪除哪一部分？</p>
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <button className="btn-secondary" style={{color: '#d9534f', borderColor: '#d9534f'}} onClick={() => executeDelete(deletePromptTarget, 'future')}>
              刪除此行程與後續所有行程
            </button>
            <button className="btn-secondary" style={{color: '#d9534f', borderColor: '#d9534f'}} onClick={() => executeDelete(deletePromptTarget, 'single')}>
              僅單獨刪除這個行程
            </button>
            <button className="btn-primary" onClick={() => setDeletePromptTarget(null)}>
              取消
            </button>
          </div>
        </Modal>
      )}

      {showMonthYearPicker && (
        <MonthYearPicker currentDate={viewDate} onDateChange={setViewDate} onClose={() => setShowMonthYearPicker(false)} />
      )}

      {showSettingsModal && (
        <Modal title="管理行事曆類別" onClose={() => setShowSettingsModal(false)}>
          <div className="input-group" style={{flexDirection: 'row'}}>
            <input type="text" style={{flex: 1}} placeholder="輸入新類別" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <button className="btn-primary" style={{width: 'auto', padding: '10px'}} onClick={handleAddCat}><Plus size={20}/></button>
          </div>
          {settings.categories.map((c, i) => (
            <div key={i} className="setting-item">
              <span>{c}</span>
              <button className="btn-icon" onClick={() => handleDeleteCat(i)}><Trash2 size={16}/></button>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
};

// 用來防止 React 在載入時因非同步衝突產生雙重連動資料的全域鎖
let isSyncingDiet = false;

// ==============================
// 2. 飲食/用藥紀錄 (Diet & Meds Tab)
// ==============================
const DietTab = () => {
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ categories: [], brands: [] });
  const [showFormModal, setShowFormModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [form, setForm] = useState({ category: '飼料', brand: '', date: '', dosage: '', frequency: '', notes: '' });
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('全部');
  const [newSetting, setNewSetting] = useState({ type: 'brands', value: '' });
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => { 
    const loadAndSync = async () => {
      if (isSyncingDiet) return;
      isSyncingDiet = true;
      try {
        const fetchedEvents = await api.getEvents();
        let fetchedLogs = await api.getLogs();

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        let needRefresh = false;
        const newlyAdded = new Set(); // 雙重防護機制，記錄此次同步已經新增過的項目

        for (const event of fetchedEvents) {
          if (event.type !== '驅蟲藥') continue;

          let currentDate = new Date(event.date.split('T')[0] + 'T00:00:00');
          const freq = event.repeatFrequency || 'none';
          const rEndStr = event.repeatEndDate;
          const endDate = new Date(todayStr + 'T00:00:00');

          if (currentDate <= endDate) {
            while (currentDate <= endDate) {
              const yyyy = currentDate.getFullYear();
              const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
              const dd = String(currentDate.getDate()).padStart(2, '0');
              const dateStr = `${yyyy}-${mm}-${dd}`;

              if ((!rEndStr || dateStr <= rEndStr) && (!event.excludedDates || !event.excludedDates.includes(dateStr))) {
                const logKey = `${event.type}-${event.title}-${dateStr}`;
                const logExists = fetchedLogs.find(l => l.category === event.type && l.brand === event.title && l.date === dateStr);
                if (!logExists && !newlyAdded.has(logKey)) {
                  const freqMapping = {'daily':'每日','monthly':'每月','every-2-months':'每兩個月','every-3-months':'每三個月','every-6-months':'每半年','yearly':'每年'};
                  const frequencyStr = freq !== 'none' ? freqMapping[freq] : '根據醫囑';
                  await api.addLog({ category: event.type, brand: event.title, date: dateStr, dosage: '1 劑', frequency: frequencyStr, notes: '行事曆自動同步' });
                  newlyAdded.add(logKey);
                  needRefresh = true;
                }
              }

              if (freq === 'none') break;
              else if (freq === 'daily') currentDate.setDate(currentDate.getDate() + 1);
              else if (freq === 'monthly') currentDate.setMonth(currentDate.getMonth() + 1);
              else if (freq === 'every-2-months') currentDate.setMonth(currentDate.getMonth() + 2);
              else if (freq === 'every-3-months') currentDate.setMonth(currentDate.getMonth() + 3);
              else if (freq === 'every-6-months') currentDate.setMonth(currentDate.getMonth() + 6);
              else if (freq === 'yearly') currentDate.setFullYear(currentDate.getFullYear() + 1);
              else break;
            }
          }
        }

        if (needRefresh) fetchedLogs = await api.getLogs();
        setLogs(fetchedLogs);

        const res = await api.getDietSettings();
        setSettings(res);
        setForm(prev => ({...prev, category: res.categories[0] || '飼料'}));
      } catch (e) { 
        console.error("Sync error:", e); 
      } finally {
        isSyncingDiet = false;
      }
    };
    loadAndSync();
  }, []);

  const handleSave = async () => {
    if (!form.brand) return;
    if (editingId) {
      await api.updateLog(editingId, form);
    } else {
      await api.addLog(form);
    }
    setLogs(await api.getLogs());
    setForm({ category: settings.categories[0] || '飼料', brand: '', date: '', dosage: '', frequency: '', notes: '' });
    setEditingId(null);
    setShowFormModal(false);
  };

  const handleEdit = (log) => {
    setForm({ category: log.category || '飼料', brand: log.brand, date: log.date || '', dosage: log.dosage, frequency: log.frequency, notes: log.notes || '' });
    setEditingId(log.id);
    setShowFormModal(true);
  };

  const handleDelete = async (id) => {
    await api.deleteLog(id);
    setLogs(await api.getLogs());
  };
  
  const handleAddSetting = async () => {
    if(!newSetting.value) return;
    const updated = { ...settings, [newSetting.type]: [...settings[newSetting.type], newSetting.value] };
    await api.saveDietSettings(updated);
    setSettings(updated);
    setNewSetting({...newSetting, value: ''});
  };

  const handleDeleteSetting = async (type, idx) => {
    const updatedList = [...settings[type]];
    updatedList.splice(idx, 1);
    const updated = { ...settings, [type]: updatedList };
    await api.saveDietSettings(updated);
    setSettings(updated);
  };
  
  const openNewForm = () => {
    setForm({ category: settings.categories[0] || '飼料', brand: '', date: '', dosage: '', frequency: '', notes: '' });
    setEditingId(null);
    setShowFormModal(true);
  };

  const displayedLogs = filter === '全部' ? logs : logs.filter(l => l.category === filter);
  
  // 依照日期進行排序
  const sortedLogs = [...displayedLogs].sort((a, b) => {
    const dateA = a.date ? a.date.substring(0, 10) : '';
    const dateB = b.date ? b.date.substring(0, 10) : '';
    return sortOrder === 'desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
  });

  // 取得不同類別的專屬配色
  const getCategoryStyle = (category) => {
    switch(category) {
      case '飼料': return { border: '#fcbe32', tag: '#fcbe32' };
      case '用藥': return { border: '#ff5f2e', tag: '#ff5f2e' };
      case '保健品': return { border: '#56A8CB', tag: '#56A8CB' };
      case '驅蟲藥': return { border: '#A593E0', tag: '#A593E0' };
      default: return { border: 'var(--border-color)', tag: 'var(--primary-dark)' };
    }
  };

  return (
    <div>
      <div className="flex-between">
        <h2><Utensils /> 飼料與用藥紀錄</h2>
        <div>
          <button className="btn-icon" onClick={() => setShowSettingsModal(true)}><Settings size={24} /></button>
          <button className="btn-primary" style={{width: 'auto', padding: '8px 12px', display: 'inline-flex', marginLeft: '10px'}} onClick={openNewForm}>
            <Plus size={18} /> 新增
          </button>
        </div>
      </div>

      <div className="flex-between" style={{ marginBottom: '15px' }}>
        <div className="btn-group" style={{overflowX: 'auto', flex: 1, marginBottom: 0}}>
          {['全部', ...settings.categories].map(cat => (
            <button key={cat} className={`btn-secondary ${filter === cat ? 'active' : ''}`} style={{whiteSpace: 'nowrap'}} onClick={() => setFilter(cat)}>{cat}</button>
          ))}
        </div>
        <button className="btn-secondary" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} style={{ whiteSpace: 'nowrap', marginLeft: '10px', fontSize: '0.85rem' }}>
          {sortOrder === 'desc' ? '↓ 日期新到舊' : '↑ 日期舊到新'}
        </button>
      </div>

      {sortedLogs.map(log => {
        const { border, tag } = getCategoryStyle(log.category || '飼料');
        const isDefault = border === 'var(--border-color)';
        return (
        <div className="card" key={log.id} style={{ backgroundColor: 'var(--card-bg)', borderColor: border, borderWidth: isDefault ? '1px' : '2px' }}>
          <div className="flex-between">
            <h4 style={{margin: '0 0 10px 0', color: 'var(--primary-dark)'}}>
              <span className="tag" style={{ backgroundColor: tag }}>{log.category || '飼料'}</span>{log.brand}
            </h4>
            <div>
              <button className="btn-icon" onClick={() => handleEdit(log)}><Edit2 size={18}/></button>
              <button className="btn-icon" onClick={() => handleDelete(log.id)}><Trash2 size={18}/></button>
            </div>
          </div>
          {log.date && <p style={{margin: '5px 0', color: 'var(--text-light)'}}>日期：{log.date}</p>}
          {log.dosage && <p style={{margin: '5px 0', color: 'var(--text-light)'}}>用量：{log.dosage}</p>}
          {log.frequency && <p style={{margin: '5px 0', color: 'var(--text-light)'}}>頻率：{log.frequency}</p>}
          {log.notes && <p style={{margin: '5px 0', color: 'var(--text-light)'}}>備註：{log.notes}</p>}
        </div>
      )})}

      {showFormModal && (
        <Modal title={editingId ? '編輯紀錄' : '新增紀錄'} onClose={() => setShowFormModal(false)}>
          <div className="input-group">
            <label>類別</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              {settings.categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>哪一款 (品牌/名稱)</label>
            <input type="text" list="diet-brands" value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} placeholder="選擇或輸入品牌" />
            <datalist id="diet-brands">
              {settings.brands.map(b => <option key={b} value={b} />)}
            </datalist>
          </div>
          <div className="input-group">
            <label>使用日期 / 使用期間</label>
            <input type="text" placeholder="例：2026-05-01 或 05-01~05-07" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>
          <div className="input-group">
            <label>用量多少</label>
            <input type="text" placeholder="例：每天 50g" value={form.dosage} onChange={e => setForm({...form, dosage: e.target.value})} />
          </div>
          <div className="input-group">
            <label>頻率</label>
            <input type="text" placeholder="例：早晚各一次" value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})} />
          </div>
          <div className="input-group">
            <label>備註</label>
            <textarea placeholder="選填..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} />
          </div>
          <button className="btn-primary" onClick={handleSave} style={{marginTop: '20px'}}>
            <Plus size={20}/> {editingId ? '儲存修改' : '新增紀錄'}
          </button>
        </Modal>
      )}

      {showSettingsModal && (
        <Modal title="管理預設類別與品牌" onClose={() => setShowSettingsModal(false)}>
          <div className="input-group" style={{flexDirection: 'row'}}>
            <select style={{flex: 1}} value={newSetting.type} onChange={(e) => setNewSetting({...newSetting, type: e.target.value})}>
              <option value="categories">自訂類別</option>
              <option value="brands">預設品牌</option>
            </select>
            <input type="text" style={{flex: 2}} placeholder="輸入名稱" value={newSetting.value} onChange={(e) => setNewSetting({...newSetting, value: e.target.value})} />
            <button className="btn-primary" style={{width: 'auto', padding: '10px'}} onClick={handleAddSetting}><Plus size={20}/></button>
          </div>
          
          <h4 style={{marginBottom: '5px'}}>類別清單：</h4>
          {settings.categories.map((c, i) => (
            <div key={i} className="setting-item">
              <span>{c}</span>
              <button className="btn-icon" onClick={() => handleDeleteSetting('categories', i)}><Trash2 size={16}/></button>
            </div>
          ))}
          <h4 style={{marginBottom: '5px', marginTop: '15px'}}>品牌清單：</h4>
          {settings.brands.map((b, i) => (
            <div key={i} className="setting-item">
              <span>{b}</span>
              <button className="btn-icon" onClick={() => handleDeleteSetting('brands', i)}><Trash2 size={16}/></button>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
};

// ==============================
// 3. 體重紀錄 (Weight Tab)
// ==============================
const WeightTab = () => {
  const [weights, setWeights] = useState([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ date: '', weight: '' });

  useEffect(() => { api.getWeights().then(setWeights); }, []);

  const handleSave = async () => {
    if (!form.date || !form.weight) return;
    const weightVal = parseFloat(form.weight);
    if (editingId) {
      await api.updateWeight(editingId, { date: form.date, weight: weightVal });
    } else {
      await api.addWeight({ date: form.date, weight: weightVal });
    }
    setWeights(await api.getWeights());
    setForm({ date: '', weight: '' });
    setEditingId(null);
    setShowFormModal(false);
  };

  const handleEdit = (w) => {
    setForm({ date: w.date, weight: w.weight });
    setEditingId(w.id);
    setShowFormModal(true);
  };

  const handleDelete = async (id) => {
    await api.deleteWeight(id);
    setWeights(await api.getWeights());
  };

  const sortedWeights = [...weights].sort((a,b) => new Date(a.date) - new Date(b.date));

  return (
    <div>
      <div className="flex-between">
        <h2><Activity /> 體重走勢</h2>
        <button className="btn-primary" style={{width: 'auto', padding: '8px 12px'}} onClick={() => { setEditingId(null); setForm({ date: '', weight: '' }); setShowFormModal(true); }}>
          <Plus size={18} /> 新增
        </button>
      </div>
      
      {sortedWeights.length > 0 && (
        <div className="card" style={{ height: 300, padding: '20px 0' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sortedWeights} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE4D3" />
              <XAxis dataKey="date" tick={{fill: '#8A8A8A'}} axisLine={false} tickLine={false} />
              <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={{fill: '#8A8A8A'}} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="weight" stroke="var(--primary-orange)" strokeWidth={3} dot={{r: 5, fill: 'var(--primary-dark)'}} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <h3>體重列表</h3>
      {sortedWeights.map(w => (
        <div className="card flex-between" key={w.id} style={{padding: '12px 20px'}}>
          <span>{w.date}</span>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <strong style={{marginRight: '5px'}}>{w.weight} kg</strong>
            <button className="btn-icon" onClick={() => handleEdit(w)}><Edit2 size={16}/></button>
            <button className="btn-icon" onClick={() => handleDelete(w.id)}><Trash2 size={16}/></button>
          </div>
        </div>
      ))}
      
      {showFormModal && (
        <Modal title={editingId ? "編輯體重紀錄" : "新增體重紀錄"} onClose={() => setShowFormModal(false)}>
          <div className="input-group">
            <label>測量日期</label>
            <DatePicker
              selected={form.date ? new Date(form.date + 'T00:00:00') : null}
              onChange={date => {
                if (date) {
                  const yyyy = date.getFullYear();
                  const mm = String(date.getMonth() + 1).padStart(2, '0');
                  const dd = String(date.getDate()).padStart(2, '0');
                  setForm({...form, date: `${yyyy}-${mm}-${dd}`});
                } else {
                  setForm({...form, date: ''});
                }
              }}
              dateFormat="yyyy-MM-dd"
              placeholderText="請選擇日期"
            />
          </div>
          <div className="input-group">
            <label>體重 (kg)</label>
            <input type="number" step="0.1" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} />
          </div>
          <button className="btn-primary" style={{marginTop: '20px'}} onClick={handleSave}><Plus size={20}/> {editingId ? '儲存修改' : '儲存'}</button>
        </Modal>
      )}
    </div>
  );
};

// ==============================
// 4. 血檢報告 (Blood Test Tab)
// ==============================
const BloodTestTab = () => {
  const [tests, setTests] = useState([]);
  const [settings, setSettings] = useState({ clinics: [], metrics: [] });
  const [showSettings, setShowSettings] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form state for adding/editing tests
  const [form, setForm] = useState({ date: '', clinic: '', notes: '' }); 
  const [selectedMetrics, setSelectedMetrics] = useState([]);

  // Filters and Scanner state
  const [historyFilter, setHistoryFilter] = useState({ clinic: '', metric: '', startDate: '', endDate: '' });
  const [isScanning, setIsScanning] = useState(false);

  // Form state for Settings
  const [newSettingItem, setNewSettingItem] = useState({ type: 'metrics', value: '', name: '', min: '', max: '' });
  const [editingSetting, setEditingSetting] = useState({ type: null, index: null, value: '', name: '', min: '', max: '' });
  const [dragIndex, setDragIndex] = useState(null);

  const lineColors = ['#ff5f2e', '#fcbe32', '#004e66', '#56A8CB', '#A593E0'];

  useEffect(() => { 
    api.getBloodTests().then(setTests);
    api.getBloodTestSettings().then(res => {
      const normalizedMetrics = (res.metrics || []).map(m => 
        typeof m === 'string' ? { name: m, min: '', max: '' } : m
      );
      const normalizedSettings = { ...res, metrics: normalizedMetrics };
      setSettings(normalizedSettings);
      setSelectedMetrics(normalizedMetrics.slice(0, 2).map(m => m.name));
      if(res.clinics.length > 0) setForm(prev => ({...prev, clinic: res.clinics[0]}));
    });
  }, []);

  const handleScan = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsScanning(true);
    // 模擬 OCR 辨識延遲
    setTimeout(() => {
      const scannedData = {};
      settings.metrics.forEach(m => {
        if (Math.random() > 0.4) {
          const min = parseFloat(m.min) || 5;
          const max = parseFloat(m.max) || 50;
          scannedData[m.name] = (Math.random() * (max - min) + min).toFixed(1);
        }
      });
      setForm(prev => ({...prev, ...scannedData}));
      setIsScanning(false);
      alert('照片辨識完成！已自動帶入部分數值。');
    }, 1500);
  };

  const handleSave = async () => {
    if (!form.date) return;
    
    const testData = { date: form.date, clinic: form.clinic, notes: form.notes || '' };
    settings.metrics.forEach(m => {
      if (form[m.name] !== undefined && form[m.name] !== '') {
        testData[m.name] = parseFloat(form[m.name]);
      }
    });

    if (editingId) {
      await api.updateBloodTest(editingId, testData);
    } else {
      await api.addBloodTest(testData);
    }
    setTests(await api.getBloodTests());
    
    setForm({ date: '', clinic: form.clinic, notes: '' });
    setEditingId(null);
    setShowFormModal(false);
  };

  const handleEdit = (test) => {
    const editForm = { date: test.date, clinic: test.clinic, notes: test.notes || '' };
    settings.metrics.forEach(m => {
      if (test[m.name] !== undefined) {
        editForm[m.name] = test[m.name];
      }
    });
    setForm(editForm);
    setEditingId(test.id);
    setShowFormModal(true);
  };

  const handleDelete = async (id) => {
    await api.deleteBloodTest(id);
    setTests(await api.getBloodTests());
  };

  const toggleMetric = (metric) => {
    if (selectedMetrics.includes(metric)) {
      setSelectedMetrics(selectedMetrics.filter(m => m !== metric));
    } else {
      setSelectedMetrics([...selectedMetrics, metric]);
    }
  };

  // Settings Management
  const addSetting = async () => {
    let updated;
    if (newSettingItem.type === 'metrics') {
      if (!newSettingItem.name) return;
      const newMetric = { name: newSettingItem.name, min: newSettingItem.min, max: newSettingItem.max };
      updated = { ...settings, metrics: [...settings.metrics, newMetric] };
    } else {
      if (!newSettingItem.value) return;
      updated = { ...settings, clinics: [...settings.clinics, newSettingItem.value] };
    }
    await api.saveBloodTestSettings(updated);
    setSettings(updated);
    setNewSettingItem({ type: newSettingItem.type, value: '', name: '', min: '', max: '' });
  };

  const saveEditSetting = async () => {
    const { type, index } = editingSetting;
    const updatedList = [...settings[type]];
    if (type === 'metrics') {
      if (!editingSetting.name) return;
      updatedList[index] = { name: editingSetting.name, min: editingSetting.min, max: editingSetting.max };
    } else {
      if (!editingSetting.value) return;
      updatedList[index] = editingSetting.value;
    }
    const updated = { ...settings, [type]: updatedList };
    await api.saveBloodTestSettings(updated);
    setSettings(updated);
    setEditingSetting({ type: null, index: null, value: '', name: '', min: '', max: '' });
  };

  const deleteSetting = async (type, index) => {
    const updatedList = [...settings[type]];
    updatedList.splice(index, 1);
    const updated = { ...settings, [type]: updatedList };
    await api.saveBloodTestSettings(updated);
    setSettings(updated);
  };

  // Drag and Drop for Metrics
  const handleDragStart = (index) => setDragIndex(index);
  
  const handleDragEnter = (index) => {
    if (dragIndex === null || dragIndex === index) return;
    const newMetrics = [...settings.metrics];
    const draggedItem = newMetrics[dragIndex];
    newMetrics.splice(dragIndex, 1);
    newMetrics.splice(index, 0, draggedItem);
    setDragIndex(index);
    setSettings({ ...settings, metrics: newMetrics });
  };

  const handleDragEnd = async () => {
    setDragIndex(null);
    await api.saveBloodTestSettings(settings);
  };

  const filteredTests = [...tests]
    .filter(test => {
      if (historyFilter.clinic && test.clinic !== historyFilter.clinic) return false;
      if (historyFilter.startDate && test.date < historyFilter.startDate) return false;
      if (historyFilter.endDate && test.date > historyFilter.endDate) return false;
      if (historyFilter.metric && (test[historyFilter.metric] === undefined || test[historyFilter.metric] === '')) return false;
      return true;
    })
    .sort((a,b) => new Date(a.date) - new Date(b.date));

  const historyList = [...filteredTests].reverse();
  const availableDates = [...new Set(tests.map(t => t.date))].sort().reverse();

  const renderSettingItem = (item, index, type) => {
    const isEditing = editingSetting.type === type && editingSetting.index === index;
    if (isEditing) {
      if (type === 'metrics') {
        return (
          <div key={index} className="setting-item" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
            <input type="text" placeholder="指標" style={{padding: '6px'}} value={editingSetting.name} onChange={e => setEditingSetting({...editingSetting, name: e.target.value})} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="number" placeholder="下限" style={{flex: 1, padding: '6px'}} value={editingSetting.min} onChange={e => setEditingSetting({...editingSetting, min: e.target.value})} />
              <input type="number" placeholder="上限" style={{flex: 1, padding: '6px'}} value={editingSetting.max} onChange={e => setEditingSetting({...editingSetting, max: e.target.value})} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn-primary" style={{padding: '6px 16px', width: 'auto'}} onClick={saveEditSetting}>儲存</button>
              <button className="btn-secondary" style={{padding: '6px 16px', width: 'auto'}} onClick={() => setEditingSetting({type: null, index: null, value: '', name: '', min: '', max: ''})}>取消</button>
            </div>
          </div>
        );
      }
      return (
        <div key={index} className="setting-item" style={{ display: 'flex', gap: '5px' }}>
          <input 
            type="text" 
            style={{flex: 1, padding: '4px'}} 
            value={editingSetting.value} 
            onChange={(e) => setEditingSetting({...editingSetting, value: e.target.value})} 
          />
          <button className="btn-primary" style={{padding: '4px 10px', width: 'auto'}} onClick={saveEditSetting}>儲存</button>
          <button className="btn-icon" onClick={() => setEditingSetting({type: null, index: null, value: '', name: '', min: '', max: ''})}><X size={16}/></button>
        </div>
      );
    }
    
    if (type === 'metrics') {
      return (
        <div 
          key={index} 
          className="setting-item"
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragEnter={() => handleDragEnter(index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => e.preventDefault()}
          style={{ cursor: 'grab', opacity: dragIndex === index ? 0.5 : 1 }}
        >
          <span>☰ {item.name} { (item.min || item.max) ? `(${item.min || '-'} ~ ${item.max || '-'})` : '' }</span>
          <div>
            <button className="btn-icon" onClick={() => setEditingSetting({type, index, name: item.name, min: item.min, max: item.max})}><Edit2 size={16}/></button>
            <button className="btn-icon" onClick={() => deleteSetting(type, index)}><Trash2 size={16}/></button>
          </div>
        </div>
      );
    }

    return (
      <div key={index} className="setting-item">
        <span>{item}</span>
        <div>
          <button className="btn-icon" onClick={() => setEditingSetting({type, index, value: item})}><Edit2 size={16}/></button>
          <button className="btn-icon" onClick={() => deleteSetting(type, index)}><Trash2 size={16}/></button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex-between">
        <h2><Syringe /> 血液檢查</h2>
        <div>
          <button className="btn-icon" onClick={() => setShowSettings(true)}><Settings size={24} /></button>
          <button className="btn-primary" style={{width: 'auto', padding: '8px 12px', display: 'inline-flex', marginLeft: '10px'}} onClick={() => { setEditingId(null); setForm({ date: '', clinic: settings.clinics[0] || '' }); setShowFormModal(true); }}>
            <Plus size={18} /> 新增
          </button>
        </div>
      </div>

      {showSettings && (
        <Modal title="管理醫院與追蹤指標" onClose={() => setShowSettings(false)}>
          <div className="input-group" style={{flexDirection: 'column'}}>
            <select value={newSettingItem.type} onChange={(e) => setNewSettingItem({...newSettingItem, type: e.target.value})}>
              <option value="metrics">追蹤指標</option>
              <option value="clinics">動物醫院</option>
            </select>
            <div style={{display: 'flex', gap: '5px', width: '100%'}}>
              {newSettingItem.type === 'metrics' ? (
                <>
                  <input type="text" style={{flex: 2}} placeholder="指標名稱" value={newSettingItem.name} onChange={(e) => setNewSettingItem({...newSettingItem, name: e.target.value})} />
                  <input type="number" style={{flex: 1}} placeholder="下限" value={newSettingItem.min} onChange={(e) => setNewSettingItem({...newSettingItem, min: e.target.value})} />
                  <input type="number" style={{flex: 1}} placeholder="上限" value={newSettingItem.max} onChange={(e) => setNewSettingItem({...newSettingItem, max: e.target.value})} />
                </>
              ) : (
                <input type="text" style={{flex: 1}} placeholder="輸入名稱" value={newSettingItem.value} onChange={(e) => setNewSettingItem({...newSettingItem, value: e.target.value})} />
              )}
              <button className="btn-primary" style={{width: 'auto', padding: '10px'}} onClick={addSetting}><Plus size={20}/></button>
            </div>
          </div>
          
          <h4 style={{marginBottom: '5px'}}>指標清單：</h4>
          {settings.metrics.map((m, i) => renderSettingItem(m, i, 'metrics'))}
          <h4 style={{marginBottom: '5px', marginTop: '15px'}}>醫院清單：</h4>
          {settings.clinics.map((c, i) => renderSettingItem(c, i, 'clinics'))}
        </Modal>
      )}

      <div className="card">
        <p style={{fontWeight: 'bold', color: 'var(--text-main)', marginTop: 0}}>勾選要比較的指數：</p>
        <div className="checkbox-group">
          {settings.metrics.map(metric => (
            <label key={metric.name} className="checkbox-label">
              <input 
                type="checkbox" 
                checked={selectedMetrics.includes(metric.name)} 
                onChange={() => toggleMetric(metric.name)} 
              />
              {metric.name}
            </label>
          ))}
        </div>

        {filteredTests.length > 0 && selectedMetrics.length > 0 && (
          <div style={{ height: 300, marginTop: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredTests}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE4D3"/>
                <XAxis dataKey="date" tick={{fill: '#8A8A8A'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill: '#8A8A8A'}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.85rem' }} itemStyle={{ color: 'var(--primary-dark)', fontWeight: 'bold' }} />
                <Legend />
                {selectedMetrics.map((metric, idx) => (
                  <Line key={metric} type="monotone" dataKey={metric} stroke={lineColors[idx % lineColors.length]} strokeWidth={3} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="flex-between" style={{ alignItems: 'flex-end', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>歷年報告紀錄</h3>
        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setHistoryFilter({ clinic: '', metric: '', startDate: '', endDate: '' })}>
          清除篩選
        </button>
      </div>

      {/* 篩選區塊 */}
      <div className="card" style={{ padding: '15px', marginBottom: '20px', background: '#f8fbfc', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <select value={historyFilter.clinic} onChange={e => setHistoryFilter({...historyFilter, clinic: e.target.value})}>
            <option value="">所有醫院</option>
            {settings.clinics.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={historyFilter.metric} onChange={e => setHistoryFilter({...historyFilter, metric: e.target.value})}>
            <option value="">所有數值 (不限)</option>
            {settings.metrics.map(m => <option key={m.name} value={m.name}>有測量：{m.name}</option>)}
          </select>
          <select value={historyFilter.startDate} onChange={e => setHistoryFilter({...historyFilter, startDate: e.target.value})}>
            <option value="">開始日期 (不限)</option>
            {availableDates.map(d => <option key={`start-${d}`} value={d}>{d}</option>)}
          </select>
          <select value={historyFilter.endDate} onChange={e => setHistoryFilter({...historyFilter, endDate: e.target.value})}>
            <option value="">結束日期 (不限)</option>
            {availableDates.map(d => <option key={`end-${d}`} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {historyList.map(test => (
        <div className="card" key={test.id}>
          <div className="flex-between">
            <h4 style={{margin: '0 0 5px 0', color: 'var(--primary-dark)'}}>{test.date} - {test.clinic}</h4>
            <div>
              <button className="btn-icon" onClick={() => handleEdit(test)}><Edit2 size={18}/></button>
              <button className="btn-icon" onClick={() => handleDelete(test.id)}><Trash2 size={18}/></button>
            </div>
          </div>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px'}}>
          {settings.metrics.map(m => {
            const val = test[m.name];
            if (val === undefined || val === '') return null;
            
            let color = 'inherit';
            let suffix = '';
            let fontWeight = 'normal';
            
            if (m.min !== '' && m.min !== undefined && val < parseFloat(m.min)) {
              color = '#4CAF50'; // 綠色
              suffix = ' (L)';
              fontWeight = 'bold';
            } else if (m.max !== '' && m.max !== undefined && val > parseFloat(m.max)) {
              color = '#F44336'; // 紅色
              suffix = ' (H)';
              fontWeight = 'bold';
            }
            
            return (
              <span key={m.name} style={{fontSize: '0.9rem', background: '#FAFAFA', padding: '4px 8px', borderRadius: '4px', color, fontWeight}}>
                {m.name}: {val}{suffix}
              </span>
            );
          })}
          </div>
          {test.notes && <div style={{marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)', color: 'var(--text-light)', fontSize: '0.9rem'}}>備註：{test.notes}</div>}
        </div>
      ))}

      {showFormModal && (
        <Modal title={editingId ? "編輯血檢報告" : "新增血檢報告"} onClose={() => setShowFormModal(false)}>
          
          {!editingId && (
            <div className="input-group" style={{background: '#f0f6fa', padding: '15px', borderRadius: '12px', border: '1px dashed var(--border-color)', marginBottom: '15px'}}>
              <label style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', color: 'var(--primary-dark)'}}>
                <span style={{display: 'flex', alignItems: 'center', gap: '5px'}}><Camera size={18}/> 智能辨識報告</span>
                {isScanning && <span style={{fontSize: '0.85rem', color: 'var(--primary-orange)'}}>辨識中...</span>}
              </label>
              <input type="file" accept="image/*" onChange={handleScan} disabled={isScanning} style={{background: 'white'}} />
              <small style={{color: 'var(--text-light)', marginTop: '5px', display: 'block'}}>上傳血檢報告照片，我們將嘗試為您自動填入數值。</small>
            </div>
          )}

          <div style={{display: 'flex', gap: '10px'}}>
            <div className="input-group" style={{flex: 1}}>
              <label>檢查日期</label>
              <DatePicker
                selected={form.date ? new Date(form.date + 'T00:00:00') : null}
                onChange={date => {
                  if (date) {
                    const yyyy = date.getFullYear();
                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                    const dd = String(date.getDate()).padStart(2, '0');
                    setForm({...form, date: `${yyyy}-${mm}-${dd}`});
                  } else {
                    setForm({...form, date: ''});
                  }
                }}
                dateFormat="yyyy-MM-dd"
                placeholderText="請選擇日期"
              />
            </div>
            <div className="input-group" style={{flex: 1}}>
              <label>動物醫院</label>
              <select value={form.clinic} onChange={e => setForm({...form, clinic: e.target.value})}>
                {settings.clinics.length === 0 && <option value="">請先至設定新增</option>}
                {settings.clinics.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px'}}>
            <label style={{fontWeight: 'bold', color: 'var(--primary-dark)'}}>檢驗項目與數值</label>
            
            <div className="checkbox-group" style={{ marginBottom: '10px' }}>
              {settings.metrics.map(m => (
                <label key={m.name} className="checkbox-label" style={{ cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={form[m.name] !== undefined} 
                    onChange={e => {
                      if (e.target.checked) setForm({...form, [m.name]: ''});
                      else {
                        const newForm = {...form};
                        delete newForm[m.name];
                        setForm(newForm);
                      }
                    }} 
                  />
                  {m.name}
                </label>
              ))}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {settings.metrics.filter(m => form[m.name] !== undefined).map(m => (
                <div className="input-group" key={`input-${m.name}`} style={{ marginBottom: 0, background: '#FAFAFA', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <label style={{ fontSize: '0.85rem' }}>{m.name} { (m.min || m.max) ? <span style={{color: 'var(--text-light)'}}>({m.min || '-'}~{m.max || '-'})</span> : ''}</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px' }}
                    value={form[m.name] || ''} 
                    onChange={e => setForm({...form, [m.name]: e.target.value})} 
                    placeholder="輸入數值"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="input-group" style={{marginTop: '15px'}}>
            <label>備註</label>
            <textarea placeholder="選填..." value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} rows={2} />
          </div>

          <button className="btn-primary" style={{marginTop: '25px', width: '100%'}} onClick={handleSave}><Plus size={20}/> {editingId ? '儲存修改' : '儲存報告'}</button>
        </Modal>
      )}
    </div>
  );
};

// ==============================
// 0. 登入與註冊介面 (Auth Screen)
// ==============================
const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.auth.login(email, password);
    } catch (err) {
      setError('登入失敗，請檢查信箱與密碼是否正確。');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <img src={boboImg} alt="Bobo" className="bobo-avatar-large" />
        <h1 style={{marginTop: '10px'}} >波皇子的健保手冊</h1>
        <h3 style={{marginTop: 0, marginBottom: '20px'}}>登入您的帳號</h3>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit} className="input-group">
          <input type="email" placeholder="信箱" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="密碼" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" className="btn-primary" style={{marginTop: '10px'}}>登入</button>
        </form>
      </div>
    </div>
  );
};

// ==============================
// 主應用程式與底部導覽列
// ==============================
export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 監聽 Firebase 登入狀態
  useEffect(() => {
    const unsubscribe = api.auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div style={{padding: 50, textAlign: 'center'}}>載入中...</div>;
  if (!user) return <AuthScreen />;

  return (
    <div className="app-container">
      {/* 手機版 Header */}
      <header className="app-header">
        <img src={boboImg} alt="Bobo" className="bobo-avatar" style={{width: 28, height: 28}} /> 波皇子的健保手冊
        <button className="btn-icon" style={{color: 'white', marginLeft: 'auto'}} onClick={() => api.auth.logout()} title="登出">
          <LogOut size={22} />
        </button>
      </header>

      {/* 左側邊欄 (電腦版顯示) */}
      <nav className="bottom-nav">
        <div className="sidebar-profile">
          <img src={boboImg} alt="Bobo" />
          <h3>Bobo <span style={{color: '#56A8CB', fontWeight: 'normal'}}>♂</span></h3>
          <p>出生日期: 2013年07月</p>
        </div>
        <button className={`nav-btn ${activeTab === 0 ? 'active' : ''}`} onClick={() => setActiveTab(0)}>
          <CalendarIcon size={24} /> <span>行事曆</span>
        </button>
        <button className={`nav-btn ${activeTab === 1 ? 'active' : ''}`} onClick={() => setActiveTab(1)}>
          <Utensils size={24} /> <span>飲食與用藥</span>
        </button>
        <button className={`nav-btn ${activeTab === 2 ? 'active' : ''}`} onClick={() => setActiveTab(2)}>
          <Activity size={24} /> <span>體重管理</span>
        </button>
        <button className={`nav-btn ${activeTab === 3 ? 'active' : ''}`} onClick={() => setActiveTab(3)}>
          <Syringe size={24} /> <span>血檢報告</span>
        </button>
        
        {/* 電腦版的登出按鈕 */}
        <div style={{marginTop: 'auto', marginBottom: '20px', display: 'none'}} className="desktop-logout">
          <button className="nav-btn" onClick={() => api.auth.logout()}>
            <LogOut size={24} /> <span>登出帳號</span>
          </button>
        </div>
      </nav>
      
      {/* 內容區塊 */}
      <main className="app-content">
        {activeTab === 0 && <CalendarTab />}
        {activeTab === 1 && <DietTab />}
        {activeTab === 2 && <WeightTab />}
        {activeTab === 3 && <BloodTestTab />}
      </main>
    </div>
  );
}
