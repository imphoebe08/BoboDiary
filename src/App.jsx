import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar as CalendarIcon, Utensils, Activity, Syringe, Plus, Trash2, Edit2, Settings, BookHeart, X, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import './bobo-theme.css';
import { api } from './api';

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

// ==============================
// 1. 行事曆介面 (Calendar Tab)
// ==============================
const CalendarTab = () => {
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState({ categories: [] });
  const [showFormModal, setShowFormModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [form, setForm] = useState({ date: '', title: '', type: '就醫', repeatDays: '' });
  const [editingId, setEditingId] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'all'
  const [newCat, setNewCat] = useState('');

  const [viewDate, setViewDate] = useState(new Date());
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth(); // 0-11

  const todayObj = new Date();
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

  const handleSave = async () => {
    if (!form.date || !form.title) return;
    const eventData = { ...form, repeatDays: parseInt(form.repeatDays) || 0 };
    if (editingId) {
      await api.updateEvent(editingId, eventData);
    } else {
      await api.addEvent(eventData);
    }
    setEvents(await api.getEvents());
    setForm({ date: '', title: '', type: settings.categories[0] || '就醫', repeatDays: '' });
    setEditingId(null);
    setShowFormModal(false);
  };

  const handleEdit = (ev) => {
    // 確保我們總是編輯原始事件，而不是重複產生的虛擬事件
    const originalEvent = events.find(e => e.id === ev.id);
    if (!originalEvent) return;
    setForm({ 
      date: originalEvent.date, 
      title: originalEvent.title, 
      type: originalEvent.type,
      repeatDays: originalEvent.repeatDays || ''
    });
    setEditingId(originalEvent.id);
    setShowFormModal(true);
  };

  const handleDelete = async (id) => {
    await api.deleteEvent(id);
    setEvents(await api.getEvents());
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
    setForm({ date: dateStr, title: '', type: settings.categories[0] || '就醫', repeatDays: '' });
    setEditingId(null);
    setShowFormModal(true);
  };

  // 處理重複事件，展開成多個虛擬事件
  const getExpandedEvents = (rawEvents) => {
    const expanded = [];
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 2); // 為了效能，只看未來兩年的重複事件

    rawEvents.forEach(event => {
      expanded.push(event); // 先加入原始事件

      if (event.repeatDays && event.repeatDays > 0) {
        let currentDate = new Date(event.date + 'T00:00:00');
        currentDate.setDate(currentDate.getDate() + event.repeatDays);

        while (currentDate <= endDate) {
          const yyyy = currentDate.getFullYear();
          const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
          const dd = String(currentDate.getDate()).padStart(2, '0');
          const newDateStr = `${yyyy}-${mm}-${dd}`;

          expanded.push({
            ...event,
            date: newDateStr, // 這是此重複事件的日期
            key: `${event.id}-${newDateStr}` // 給 React 用的唯一 key
          });
          currentDate.setDate(currentDate.getDate() + event.repeatDays);
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
            <h3 onClick={handleToday} title="回到今天">{currentYear} 年 {currentMonth + 1} 月</h3>
            <button className="btn-icon" onClick={handleNextMonth}><ChevronRight size={24} /></button>
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
            return (
              <div key={d} className={`calendar-cell ${dayEvents.length > 0 ? 'has-event' : ''} ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''}`} onClick={() => !isPast && openNewForm(dateStr)}>
                <span style={{fontWeight: isToday ? 'bold' : 'normal'}}>{d}</span>
                <div style={{width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                  {dayEvents.slice(0, 2).map(ev => <div key={ev.key || ev.id} className="event-pill" title={ev.title}>{ev.title}</div>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  const allVisibleEvents = getExpandedEvents(events);

  let displayedEvents = allVisibleEvents.sort((a,b) => new Date(a.date) - new Date(b.date));

  if (viewMode === 'all') {
    const seenRepeating = new Set();
    displayedEvents = displayedEvents.filter(ev => {
      if (ev.repeatDays && ev.repeatDays > 0) {
        if (ev.date < todayStr) return false; // 隱藏過去的重複行程
        if (seenRepeating.has(ev.id)) return false; // 只保留未來的第一次，後續不再顯示
        seenRepeating.add(ev.id);
      }
      return true;
    });
  } else {
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    displayedEvents = displayedEvents.filter(ev => ev.date.startsWith(monthPrefix));
  }

  return (
    <div>
      <h2><CalendarIcon /> 行事曆</h2>
      {renderCalendar()}

      <div className="btn-group">
        <button className={`btn-secondary ${viewMode === 'month' ? 'active' : ''}`} onClick={() => setViewMode('month')}>本月行程</button>
        <button className={`btn-secondary ${viewMode === 'all' ? 'active' : ''}`} onClick={() => setViewMode('all')}>全部行程</button>
      </div>

      {displayedEvents.map(ev => (
        <div className="card flex-between" key={ev.key || ev.id}>
          <div>
            <span className="tag">{ev.type}</span>
            <strong>{ev.date}</strong> - {ev.title}
          </div>
          <div>
            <button className="btn-icon" onClick={() => handleEdit(ev)}><Edit2 size={18} /></button>
            <button className="btn-icon" onClick={() => handleDelete(ev.id)}><Trash2 size={18} /></button>
          </div>
        </div>
      ))}

      {showFormModal && (
        <Modal title={editingId ? '編輯排程' : '新增排程'} onClose={() => setShowFormModal(false)}>
          <div className="input-group">
            <label>日期</label>
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
            <label style={{display: 'flex', justifyContent: 'space-between'}}>
              項目類別 
              <button className="btn-icon" onClick={() => setShowSettingsModal(true)} style={{padding: 0}}><Settings size={16}/></button>
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
          <div className="input-group">
            <label>重複週期 (天)</label>
            <input type="number" placeholder="例如: 7 (每週重複), 留空為不重複" value={form.repeatDays} onChange={e => setForm({...form, repeatDays: e.target.value})} />
          </div>
          <button className="btn-primary" onClick={handleSave} style={{marginTop: '20px'}}>
            <Plus size={20} /> {editingId ? '儲存修改' : '新增排程'}
          </button>
        </Modal>
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

// ==============================
// 2. 飲食/用藥紀錄 (Diet & Meds Tab)
// ==============================
const DietTab = () => {
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ categories: [], brands: [] });
  const [showFormModal, setShowFormModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [form, setForm] = useState({ category: '飼料', brand: '', date: '', dosage: '', frequency: '' });
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('全部');
  const [newSetting, setNewSetting] = useState({ type: 'brands', value: '' });

  useEffect(() => { 
    const loadAndSync = async () => {
      try {
        const fetchedEvents = await api.getEvents();
        let fetchedLogs = await api.getLogs();

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        let needRefresh = false;

        for (const event of fetchedEvents) {
          if (event.type !== '驅蟲藥') continue;

          let currentDate = new Date(event.date + 'T00:00:00');
          const repeatDays = parseInt(event.repeatDays) || 0;
          const endDate = new Date(todayStr + 'T00:00:00');

          if (currentDate <= endDate) {
            while (currentDate <= endDate) {
              const yyyy = currentDate.getFullYear();
              const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
              const dd = String(currentDate.getDate()).padStart(2, '0');
              const dateStr = `${yyyy}-${mm}-${dd}`;
              const logExists = fetchedLogs.find(l => l.category === '用藥' && l.brand === event.title && l.date === dateStr);

              if (!logExists) {
                const frequencyStr = repeatDays > 0 ? `每 ${repeatDays} 天` : '根據醫囑';
                await api.addLog({ category: '用藥', brand: event.title, date: dateStr, dosage: '1 劑', frequency: frequencyStr });
                needRefresh = true;
              }

              if (repeatDays <= 0) break;
              currentDate.setDate(currentDate.getDate() + repeatDays);
            }
          }
        }

        if (needRefresh) fetchedLogs = await api.getLogs();
        setLogs(fetchedLogs);

        const res = await api.getDietSettings();
        setSettings(res);
        setForm(prev => ({...prev, category: res.categories[0] || '飼料'}));
      } catch (e) { console.error("Sync error:", e); }
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
    setForm({ category: settings.categories[0] || '飼料', brand: '', date: '', dosage: '', frequency: '' });
    setEditingId(null);
    setShowFormModal(false);
  };

  const handleEdit = (log) => {
    setForm({ category: log.category || '飼料', brand: log.brand, date: log.date || '', dosage: log.dosage, frequency: log.frequency });
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
    setForm({ category: settings.categories[0] || '飼料', brand: '', date: '', dosage: '', frequency: '' });
    setEditingId(null);
    setShowFormModal(true);
  };

  const displayedLogs = filter === '全部' ? logs : logs.filter(l => l.category === filter);

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

      <div className="btn-group" style={{overflowX: 'auto'}}>
        {['全部', ...settings.categories].map(cat => (
          <button key={cat} className={`btn-secondary ${filter === cat ? 'active' : ''}`} onClick={() => setFilter(cat)}>{cat}</button>
        ))}
      </div>

      {displayedLogs.map(log => (
        <div className="card" key={log.id}>
          <div className="flex-between">
            <h4 style={{margin: '0 0 10px 0', color: 'var(--primary-orange)'}}>
              <span className="tag">{log.category || '飼料'}</span>{log.brand}
            </h4>
            <div>
              <button className="btn-icon" onClick={() => handleEdit(log)}><Edit2 size={18}/></button>
              <button className="btn-icon" onClick={() => handleDelete(log.id)}><Trash2 size={18}/></button>
            </div>
          </div>
          {log.date && <p style={{margin: '5px 0', color: 'var(--text-light)'}}>日期：{log.date}</p>}
          {log.dosage && <p style={{margin: '5px 0', color: 'var(--text-light)'}}>用量：{log.dosage}</p>}
          {log.frequency && <p style={{margin: '5px 0', color: 'var(--text-light)'}}>頻率：{log.frequency}</p>}
        </div>
      ))}

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
            <label>使用日期</label>
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
            <label>用量多少</label>
            <input type="text" placeholder="例：每天 50g" value={form.dosage} onChange={e => setForm({...form, dosage: e.target.value})} />
          </div>
          <div className="input-group">
            <label>頻率</label>
            <input type="text" placeholder="例：早晚各一次" value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})} />
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
              <Line type="monotone" dataKey="weight" stroke="var(--primary-orange)" strokeWidth={3} dot={{r: 5, fill: 'var(--primary-green)'}} activeDot={{ r: 8 }} />
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
  const [form, setForm] = useState({ date: '', clinic: '' }); 
  const [selectedMetrics, setSelectedMetrics] = useState([]);

  // Form state for Settings
  const [newSettingItem, setNewSettingItem] = useState({ type: 'metrics', value: '', name: '', min: '', max: '' });
  const [editingSetting, setEditingSetting] = useState({ type: null, index: null, value: '', name: '', min: '', max: '' });
  const [dragIndex, setDragIndex] = useState(null);

  const lineColors = ['#E6A87C', '#8FB9A8', '#E2C275', '#A593E0', '#56A8CB'];

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

  const handleSave = async () => {
    if (!form.date) return;
    
    // Prepare data: convert metric string values to floats
    const testData = { date: form.date, clinic: form.clinic };
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
    
    setForm({ date: '', clinic: form.clinic });
    setEditingId(null);
    setShowFormModal(false);
  };

  const handleEdit = (test) => {
    const editForm = { date: test.date, clinic: test.clinic };
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

  const sortedTests = [...tests].sort((a,b) => new Date(a.date) - new Date(b.date));

  const renderSettingItem = (item, index, type) => {
    const isEditing = editingSetting.type === type && editingSetting.index === index;
    if (isEditing) {
      if (type === 'metrics') {
        return (
          <div key={index} className="setting-item" style={{ display: 'flex', gap: '5px' }}>
            <input type="text" placeholder="指標" style={{flex: 2, padding: '4px'}} value={editingSetting.name} onChange={e => setEditingSetting({...editingSetting, name: e.target.value})} />
            <input type="number" placeholder="下限" style={{flex: 1, padding: '4px'}} value={editingSetting.min} onChange={e => setEditingSetting({...editingSetting, min: e.target.value})} />
            <input type="number" placeholder="上限" style={{flex: 1, padding: '4px'}} value={editingSetting.max} onChange={e => setEditingSetting({...editingSetting, max: e.target.value})} />
            <button className="btn-primary" style={{padding: '4px 10px', width: 'auto'}} onClick={saveEditSetting}>儲存</button>
            <button className="btn-icon" onClick={() => setEditingSetting({type: null, index: null, value: '', name: '', min: '', max: ''})}><X size={16}/></button>
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

        {sortedTests.length > 0 && selectedMetrics.length > 0 && (
          <div style={{ height: 300, marginTop: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sortedTests}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE4D3"/>
                <XAxis dataKey="date" tick={{fill: '#8A8A8A'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill: '#8A8A8A'}} axisLine={false} tickLine={false}/>
                <Tooltip />
                <Legend />
                {selectedMetrics.map((metric, idx) => (
                  <Line key={metric} type="monotone" dataKey={metric} stroke={lineColors[idx % lineColors.length]} strokeWidth={3} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <h3>歷年報告紀錄</h3>
      {sortedTests.map(test => (
        <div className="card" key={test.id}>
          <div className="flex-between">
            <h4 style={{margin: '0 0 5px 0', color: 'var(--primary-green)'}}>{test.date} - {test.clinic}</h4>
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
        </div>
      ))}

      {showFormModal && (
        <Modal title={editingId ? "編輯血檢報告" : "新增血檢報告"} onClose={() => setShowFormModal(false)}>
          <div className="input-group">
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
          <div className="input-group">
            <label>動物醫院</label>
            <select value={form.clinic} onChange={e => setForm({...form, clinic: e.target.value})}>
              {settings.clinics.length === 0 && <option value="">請先至設定新增醫院</option>}
              {settings.clinics.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
            {settings.metrics.map(m => (
              <div className="input-group" key={m.name}>
                <label>{m.name}</label>
                <input type="number" step="0.1" value={form[m.name] || ''} onChange={e => setForm({...form, [m.name]: e.target.value})} />
              </div>
            ))}
          </div>

          <div className="input-group">
            <label>上傳照片 (示意按鈕)</label>
            <input type="file" accept="image/*" />
          </div>

          <button className="btn-primary" style={{marginTop: '20px'}} onClick={handleSave}><Plus size={20}/> {editingId ? '儲存修改' : '儲存報告'}</button>
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
        <h1><BookHeart size={32} /> 波波日記本</h1>
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
        <BookHeart size={24} /> 波波的健康日記本
        <button className="btn-icon" style={{color: 'white', marginLeft: 'auto'}} onClick={() => api.auth.logout()} title="登出">
          <LogOut size={22} />
        </button>
      </header>

      {/* 左側邊欄 (電腦版顯示) */}
      <nav className="bottom-nav">
        <div className="app-header" style={{display: 'none', background: 'transparent', color: 'var(--primary-orange)', marginBottom: '20px'}}>
           <BookHeart size={28} /> <strong>波波日記本</strong>
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
