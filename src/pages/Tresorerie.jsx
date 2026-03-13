import React, { useEffect, useState } from 'react'
import PageShell from '../components/layout/PageShell'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal, { Field, Input, Select } from '../components/ui/Modal'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ui/Toast'

const CATEGORIES = ['Cotisation','Subvention','Sponsor','Don','Vente','Équipement','Transport','Location','Salaire','Autre']
const EMPTY = { type: 'recette', libelle: '', montant: '', categorie: 'Cotisation', date_operation: new Date().toISOString().split('T')[0] }

async function getClubId() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profil } = await supabase.from('profils').select('club_id').eq('id', user.id).single()
  return profil.club_id
}

function KpiMini({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
      <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9BA8B5', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 900, fontSize: '1.9rem', color: '#0B1A3E' }}>{value}</div>
    </div>
  )
}

export default function Tresorerie() {
  const [ops, setOps] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filtreType, setFiltreType] = useState('tous')
  const { toasts, success, error: toastError } = useToast()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('operations').select('*').order('date_operation', { ascending: false })
    setOps(data || [])
    setLoading(false)
  }

  const recettes = ops.filter(o => o.type === 'recette').reduce((a, o) => a + +o.montant, 0)
  const depenses = ops.filter(o => o.type === 'depense').reduce((a, o) => a + +o.montant, 0)
  const solde = recettes - depenses
  const fmt = v => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
  const visible = ops.filter(o => filtreType === 'tous' ? true : o.type === filtreType)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function save() {
    if (!form.libelle || !form.montant) return
    setSaving(true)
    const club_id = await getClubId()
    const { error } = await supabase.from('operations').insert({
      ...form, montant: parseFloat(form.montant), club_id
    })
    if (error) toastError(`Erreur : ${error.message}`)
    else { success('Opération enregistrée ✓'); setModal(false); setForm(EMPTY); load() }
    setSaving(false)
  }

  async function deleteOp(id) {
    if (!confirm('Supprimer cette opération ?')) return
    await supabase.from('operations').delete().eq('id', id)
    success('Opération supprimée')
    load()
  }

  const catColors = { Cotisation: 'blue', Subvention: 'green', Sponsor: 'yellow', Don: 'teal', Équipement: 'orange', Transport: 'orange', Autre: 'gray' }

  return (
    <PageShell
      title="Trésorerie"
      subtitle="Recettes, dépenses et solde du club"
      actions={<>
        <Button variant="ghost" onClick={() => success('⬇ Export Excel en cours…')}>⬇ Exporter</Button>
        <Button variant="blue" onClick={() => { setForm(EMPTY); setModal(true) }}>+ Saisir une opération</Button>
      </>}
    >
      <ToastContainer toasts={toasts} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 22 }}>
        <KpiMini label="Total recettes" value={fmt(recettes)} color="#00A86B" />
        <KpiMini label="Total dépenses" value={fmt(depenses)} color="#E53E3E" />
        <KpiMini label="Solde actuel"   value={fmt(solde)}    color={solde >= 0 ? '#1A5FFF' : '#E53E3E'} />
      </div>
      <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
        {[['tous','Toutes'],['recette','Recettes'],['depense','Dépenses']].map(([k, l]) => (
          <div key={k} onClick={() => setFiltreType(k)}
            style={{ padding: '6px 14px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 500, border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s', borderColor: filtreType === k ? '#0B1A3E' : '#E2E8F0', background: filtreType === k ? '#0B1A3E' : '#fff', color: filtreType === k ? '#fff' : '#6B7A8D' }}>{l}</div>
        ))}
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F5F7FA', borderBottom: '1px solid #E2E8F0' }}>
              {['Date','Libellé','Catégorie','Montant',''].map((h,i) => (
                <th key={i} style={{ padding: '10px 14px', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: '#9BA8B5', letterSpacing: '0.05em', textAlign: i === 3 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#9BA8B5' }}>Chargement…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#9BA8B5' }}>
                Aucune opération. <span onClick={() => setModal(true)} style={{ color: '#1A5FFF', cursor: 'pointer' }}>Saisir la première →</span>
              </td></tr>
            ) : visible.map(op => (
              <tr key={op.id} style={{ borderBottom: '1px solid #F5F7FA', transition: 'background 0.12s' }}
                onMouseOver={e => e.currentTarget.style.background = '#F8FAFF'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: '#9BA8B5' }}>
                  {new Date(op.date_operation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#0B1A3E', fontWeight: 500 }}>{op.libelle}</td>
                <td style={{ padding: '10px 14px' }}>
                  {op.categorie && <Badge variant={catColors[op.categorie] || 'gray'}>{op.categorie}</Badge>}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: op.type === 'recette' ? '#00A86B' : '#E53E3E' }}>
                  {op.type === 'recette' ? '+' : '–'}{fmt(+op.montant)}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <button onClick={() => deleteOp(op.id)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', color: '#9BA8B5' }} title="Supprimer">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Saisir une opération"
        footer={<>
          <Button variant="ghost" onClick={() => setModal(false)}>Annuler</Button>
          <Button variant="blue" loading={saving} onClick={save}>Enregistrer</Button>
        </>}
      >
        <Field label="Type d'opération">
          <div style={{ display: 'flex', gap: 8 }}>
            {['recette','depense'].map(t => (
              <div key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                style={{ flex: 1, padding: '10px', borderRadius: 9, textAlign: 'center', border: '1.5px solid', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600, borderColor: form.type === t ? (t === 'recette' ? '#00A86B' : '#E53E3E') : '#E2E8F0', background: form.type === t ? (t === 'recette' ? '#E6F7F1' : '#FFF0F0') : '#fff', color: form.type === t ? (t === 'recette' ? '#00A86B' : '#E53E3E') : '#6B7A8D' }}>
                {t === 'recette' ? '↑ Recette' : '↓ Dépense'}
              </div>
            ))}
          </div>
        </Field>
        <Field label="Libellé"><Input value={form.libelle} onChange={set('libelle')} required placeholder="ex. Cotisation — Marc Dupont" /></Field>
        <Field label="Montant (€)"><Input type="number" step="0.01" min="0" value={form.montant} onChange={set('montant')} required placeholder="120.00" /></Field>
        <Field label="Catégorie">
          <Select value={form.categorie} onChange={set('categorie')}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={form.date_operation} onChange={set('date_operation')} /></Field>
      </Modal>
    </PageShell>
  )
}
