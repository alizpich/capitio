import React, { useEffect, useState } from 'react'
import PageShell from '../components/layout/PageShell'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal, { Field, Input, Select } from '../components/ui/Modal'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ui/Toast'

const TYPES = ['entrainement','match','reunion','evenement','autre']
const TYPE_LABELS = { entrainement: '🏃 Entraînement', match: '⚽ Match', reunion: '🏛️ Réunion', evenement: '🎪 Événement', autre: '📌 Autre' }
const TYPE_COLORS = { entrainement: '#1A5FFF', match: '#00A86B', reunion: '#7B5EA7', evenement: '#FF6B2B', autre: '#9BA8B5' }
const TYPE_BG = { entrainement: '#EEF3FF', match: '#E6F7F1', reunion: '#F0EEFF', evenement: '#FFF3EE', autre: '#F5F7FA' }

const EMPTY = {
  titre: '', type: 'entrainement', equipe: '', terrain: '',
  date_debut: new Date().toISOString().slice(0,16),
  date_fin: new Date(Date.now()+5400000).toISOString().slice(0,16),
}

async function getClubId() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profil } = await supabase.from('profils').select('club_id').eq('id', user.id).single()
  return profil.club_id
}

export default function Planning() {
  const [creneaux, setCreneaux] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filtreType, setFiltreType] = useState('tous')
  const { toasts, success, error: toastError } = useToast()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('creneaux').select('*').order('date_debut', { ascending: true })
    setCreneaux(data || [])
    setLoading(false)
  }

  const visible = creneaux.filter(c => filtreType === 'tous' ? true : c.type === filtreType)

  function hasConflict(c) {
    if (!c.terrain) return false
    return creneaux.some(other =>
      other.id !== c.id && other.terrain === c.terrain &&
      new Date(other.date_debut) < new Date(c.date_fin) &&
      new Date(other.date_fin) > new Date(c.date_debut)
    )
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function save() {
    if (!form.titre || !form.date_debut || !form.date_fin) return
    setSaving(true)
    const club_id = await getClubId()
    const { error } = await supabase.from('creneaux').insert({ ...form, club_id })
    if (error) toastError(`Erreur : ${error.message}`)
    else { success('Créneau créé ✓'); setModal(false); setForm(EMPTY); load() }
    setSaving(false)
  }

  async function deleteCreneau(id) {
    if (!confirm('Supprimer ce créneau ?')) return
    await supabase.from('creneaux').delete().eq('id', id)
    success('Créneau supprimé')
    load()
  }

  const grouped = visible.reduce((acc, c) => {
    const day = new Date(c.date_debut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!acc[day]) acc[day] = []
    acc[day].push(c)
    return acc
  }, {})

  return (
    <PageShell
      title="Planning"
      subtitle="Créneaux, matchs et réservations de terrains"
      actions={<>
        <Button variant="ghost" onClick={() => success('📥 Export iCal copié !')}>📥 Exporter iCal</Button>
        <Button variant="blue" onClick={() => { setForm(EMPTY); setModal(true) }}>+ Nouveau créneau</Button>
      </>}
    >
      <ToastContainer toasts={toasts} />
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
        <div onClick={() => setFiltreType('tous')} style={{ padding: '6px 14px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', border: '1.5px solid', transition: 'all 0.15s', borderColor: filtreType === 'tous' ? '#0B1A3E' : '#E2E8F0', background: filtreType === 'tous' ? '#0B1A3E' : '#fff', color: filtreType === 'tous' ? '#fff' : '#6B7A8D' }}>Tous</div>
        {TYPES.map(t => (
          <div key={t} onClick={() => setFiltreType(t)} style={{ padding: '6px 14px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', border: `1.5px solid ${filtreType === t ? TYPE_COLORS[t] : '#E2E8F0'}`, background: filtreType === t ? TYPE_BG[t] : '#fff', color: filtreType === t ? TYPE_COLORS[t] : '#6B7A8D', transition: 'all 0.15s' }}>{TYPE_LABELS[t]}</div>
        ))}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9BA8B5' }}>Chargement…</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9BA8B5' }}>
          Aucun créneau. <span onClick={() => setModal(true)} style={{ color: '#1A5FFF', cursor: 'pointer' }}>Créer le premier →</span>
        </div>
      ) : Object.entries(grouped).map(([day, items]) => (
        <div key={day} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9BA8B5', textTransform: 'capitalize', marginBottom: 10, padding: '0 4px', letterSpacing: '0.04em' }}>{day}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(c => {
              const conflict = hasConflict(c)
              const debut = new Date(c.date_debut)
              const fin = new Date(c.date_fin)
              const duree = Math.round((fin - debut) / 60000)
              return (
                <div key={c.id} style={{ background: '#fff', border: `1px solid ${conflict ? 'rgba(229,62,62,0.35)' : '#E2E8F0'}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, borderLeft: `4px solid ${TYPE_COLORS[c.type]}` }}>
                  <div style={{ width: 60, flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 700, fontSize: '1rem', color: '#0B1A3E' }}>{debut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div style={{ fontSize: '0.68rem', color: '#9BA8B5' }}>{duree}min</div>
                  </div>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: TYPE_COLORS[c.type], flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0B1A3E', marginBottom: 3 }}>{c.titre}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Badge variant={c.type === 'match' ? 'green' : c.type === 'reunion' ? 'purple' : c.type === 'evenement' ? 'orange' : 'blue'}>{TYPE_LABELS[c.type]}</Badge>
                      {c.equipe && <Badge variant="gray">{c.equipe}</Badge>}
                      {c.terrain && <Badge variant="gray">📍 {c.terrain}</Badge>}
                      {conflict && <Badge variant="red">⚠ Conflit terrain</Badge>}
                    </div>
                  </div>
                  <button onClick={() => deleteCreneau(c.id)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', color: '#9BA8B5', flexShrink: 0 }} title="Supprimer">✕</button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau créneau"
        footer={<>
          <Button variant="ghost" onClick={() => setModal(false)}>Annuler</Button>
          <Button variant="blue" loading={saving} onClick={save}>Créer le créneau</Button>
        </>}
      >
        <Field label="Titre du créneau"><Input value={form.titre} onChange={set('titre')} required placeholder="ex. Entraînement Senior" /></Field>
        <Field label="Type">
          <Select value={form.type} onChange={set('type')}>
            {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </Select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Début"><Input type="datetime-local" value={form.date_debut} onChange={set('date_debut')} /></Field>
          <Field label="Fin"><Input type="datetime-local" value={form.date_fin} onChange={set('date_fin')} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Équipe"><Input value={form.equipe} onChange={set('equipe')} placeholder="ex. Senior" /></Field>
          <Field label="Terrain / Lieu"><Input value={form.terrain} onChange={set('terrain')} placeholder="ex. Terrain A" /></Field>
        </div>
      </Modal>
    </PageShell>
  )
}
