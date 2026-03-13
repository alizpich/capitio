import React, { useEffect, useState } from 'react'
import PageShell from '../components/layout/PageShell'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal, { Field, Input, Select } from '../components/ui/Modal'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ui/Toast'

const EQUIPES = ['Senior', 'Senior F', 'U18', 'U15', 'U15 Fém.', 'U12', 'U10', 'Loisirs']
const BADGE_LICENCE = { valide: 'green', en_attente: 'yellow', expiree: 'red' }
const BADGE_COTIS   = { reglee: 'green', en_attente: 'yellow', en_retard: 'red' }
const LABEL_LICENCE = { valide: 'Validée', en_attente: 'En attente', expiree: 'Expirée' }
const LABEL_COTIS   = { reglee: 'Réglée', en_attente: 'En attente', en_retard: 'En retard' }

const EMPTY_FORM = {
  prenom: '', nom: '', email: '', telephone: '', equipe: '',
  role_club: 'joueur',
  is_coach: false, licence_statut: 'en_attente', cotisation_statut: 'en_attente',
  certificat_date: '',
}

async function getClubId() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profil } = await supabase.from('profils').select('club_id').eq('id', user.id).single()
  return profil.club_id
}

export default function Membres() {
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('tous')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const { toasts, success, error: toastError } = useToast()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('membres').select('*').eq('actif', true).order('nom')
    if (!error) setMembres(data)
    setLoading(false)
  }

  const filtres = [
    { key: 'tous',     label: `Tous (${membres.length})` },
    { key: 'joueur',   label: `⚽ Joueurs (${membres.filter(m => m.role_club === 'joueur' || m.role_club === 'les_deux').length})` },
    { key: 'benevole', label: `🙋 Bénévoles (${membres.filter(m => m.role_club === 'benevole' || m.role_club === 'les_deux').length})` },
    { key: 'coach',    label: `🎽 Coachs (${membres.filter(m => m.is_coach).length})` },
    { key: 'alerte',   label: `⚠️ Alertes (${membres.filter(m => (m.certificat_date && new Date(m.certificat_date) < new Date(Date.now() + 14*864e5)) || m.cotisation_statut === 'en_retard').length})` },
  ]

  const visible = membres.filter(m => {
    const matchSearch = search === '' ||
      `${m.prenom} ${m.nom} ${m.email}`.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (filtre === 'tous') return true
    if (filtre === 'joueur') return m.role_club === 'joueur' || m.role_club === 'les_deux'
    if (filtre === 'benevole') return m.role_club === 'benevole' || m.role_club === 'les_deux'
    if (filtre === 'coach') return m.is_coach
    if (filtre === 'alerte') return (
      (m.certificat_date && new Date(m.certificat_date) < new Date(Date.now() + 14*864e5)) ||
      m.cotisation_statut === 'en_retard'
    )
    return (m.equipe || '').toLowerCase() === filtre
  })

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  function openNew() { setForm(EMPTY_FORM); setEditId(null); setModal(true) }
  function openEdit(m) {
    setForm({ ...m, certificat_date: m.certificat_date || '', equipe: m.equipe || '' })
    setEditId(m.id); setModal(true)
  }

  async function save() {
    if (!form.prenom || !form.nom) { toastError('Prénom et nom sont obligatoires'); return }
    setSaving(true)
    const payload = { ...form }
    if (!payload.equipe) delete payload.equipe
    delete payload.id; delete payload.club_id; delete payload.created_at; delete payload.actif

    let err
    if (editId) {
      const res = await supabase.from('membres').update(payload).eq('id', editId)
      err = res.error
    } else {
      const club_id = await getClubId()
      const res = await supabase.from('membres').insert({ ...payload, club_id })
      err = res.error
    }

    if (err) { toastError(`Erreur : ${err.message}`) }
    else { success(editId ? 'Membre mis à jour ✓' : 'Membre créé ✓'); setModal(false); load() }
    setSaving(false)
  }

  async function sendRelance(m) {
    success(`📧 Relance cotisation envoyée à ${m.prenom} ${m.nom}`)
  }

  const initials = m => `${m.prenom?.[0] ?? ''}${m.nom?.[0] ?? ''}`.toUpperCase()
  const avColors = ['#4A7FFF','#9B59B6','#00A86B','#E53E3E','#F6A623','#0891B2','#7B5EA7','#1A5FFF']
  const avColor = m => avColors[(m.prenom?.charCodeAt(0) ?? 0) % avColors.length]

  const coachsPanel = membres.filter(m => m.is_coach)
  const isJoueur = form.role_club === 'joueur' || form.role_club === 'les_deux'

  const roleLabel = r => ({ joueur: '⚽ Joueur', benevole: '🙋 Bénévole', les_deux: '⚽🙋 Joueur & Bénévole' })[r] || r
  const roleBadge = r => ({ joueur: 'blue', benevole: 'green', les_deux: 'purple' })[r] || 'gray'

  return (
    <PageShell
      title="Membres"
      subtitle={`${membres.length} membres actifs`}
      actions={<>
        <Button variant="ghost" onClick={() => success('⬇ Export en cours…')}>⬇ Exporter</Button>
        <Button variant="blue" onClick={openNew}>+ Ajouter un membre</Button>
      </>}
    >
      <ToastContainer toasts={toasts} />

      {membres.some(m => m.certificat_date && new Date(m.certificat_date) < new Date(Date.now() + 14*864e5)) && (
        <div style={{ background: '#FFF3EE', border: '1px solid rgba(255,107,43,0.25)', borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, fontSize: '0.83rem' }}>
          ⚠️ <strong>Certificats médicaux</strong> — certains membres ont un certificat expirant sous 14 jours.
        </div>
      )}

      {coachsPanel.length > 0 && (filtre === 'tous' || filtre === 'coach') && (
        <div style={{ background: '#fff', border: '1.5px solid rgba(123,94,167,0.25)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div style={{ background: '#F0EEFF', margin: '-18px -18px 14px', padding: '11px 18px', borderRadius: '12px 12px 0 0', fontSize: '0.78rem', fontWeight: 700, color: '#7B5EA7' }}>
            🎽 Coachs du club — contacts directs
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {coachsPanel.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: avColor(m), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {initials(m)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0B1A3E' }}>{m.prenom} {m.nom}</div>
                  <div style={{ fontSize: '0.71rem', color: '#9BA8B5' }}>{m.equipe} {m.equipement_coach ? `· ${m.equipement_coach}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {m.telephone && <a href={`tel:${m.telephone}`} style={{ width: 27, height: 27, borderRadius: 7, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', textDecoration: 'none' }}>📞</a>}
                  {m.email && <a href={`mailto:${m.email}`} style={{ width: 27, height: 27, borderRadius: 7, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', textDecoration: 'none' }}>📧</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: '#F5F7FA', border: '1.5px solid #E2E8F0', borderRadius: 9, padding: '8px 14px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Rechercher…" style={{ background: 'none', border: 'none', outline: 'none', fontSize: '0.82rem', color: '#0B1A3E', width: '100%', fontFamily: 'inherit' }} />
        </div>
        {filtres.map(f => {
          const isOn = filtre === f.key
          return (
            <div key={f.key} onClick={() => setFiltre(f.key)}
              style={{ padding: '6px 14px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 500, border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
                borderColor: isOn ? '#0B1A3E' : '#E2E8F0', background: isOn ? '#0B1A3E' : '#fff', color: isOn ? '#fff' : '#6B7A8D' }}>
              {f.label}
            </div>
          )
        })}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F5F7FA', borderBottom: '1px solid #E2E8F0' }}>
              {['Membre','Rôle','Équipe','Contact','Licence','Cotisation',''].map((h,i) => (
                <th key={i} style={{ padding: '11px 14px', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#9BA8B5', textAlign: i === 6 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#9BA8B5' }}>Chargement…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#9BA8B5' }}>
                {search ? `Aucun résultat pour "${search}"` : 'Aucun membre. Ajoutez votre premier membre →'}
              </td></tr>
            ) : visible.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid #F5F7FA', transition: 'background 0.12s' }}
                onMouseOver={e => e.currentTarget.style.background = '#F8FAFF'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: avColor(m), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials(m)}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 600, color: '#0B1A3E' }}>
                        {m.prenom} {m.nom}
                        {m.is_coach && <Badge variant="purple">🎽 Coach</Badge>}
                      </div>
                      {m.email && <div style={{ fontSize: '0.72rem', color: '#9BA8B5' }}>{m.email}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <Badge variant={roleBadge(m.role_club)}>{roleLabel(m.role_club)}</Badge>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {m.equipe && <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 7, fontSize: '0.72rem', fontWeight: 500, background: '#F5F7FA', color: '#0B1A3E', border: '1px solid #E2E8F0' }}>{m.equipe}</span>}
                </td>
                <td style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#9BA8B5' }}>{m.telephone || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <Badge variant={BADGE_LICENCE[m.licence_statut] || 'gray'}>{LABEL_LICENCE[m.licence_statut]}</Badge>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <Badge variant={BADGE_COTIS[m.cotisation_statut] || 'gray'}>{LABEL_COTIS[m.cotisation_statut]}</Badge>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                    {m.cotisation_statut === 'en_retard' && (
                      <button onClick={() => sendRelance(m)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: '0.78rem' }}>📧</button>
                    )}
                    <button onClick={() => openEdit(m)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: '0.78rem' }}>✏️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)}
        title={editId ? 'Modifier le membre' : 'Ajouter un membre'}
        subtitle={editId ? `${form.prenom} ${form.nom}` : 'Seuls prénom et nom sont obligatoires.'}
        footer={<>
          <Button variant="ghost" onClick={() => setModal(false)}>Annuler</Button>
          <Button variant="blue" loading={saving} onClick={save}>{editId ? 'Enregistrer' : 'Créer le membre'}</Button>
        </>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <Field label="Prénom *"><Input value={form.prenom} onChange={set('prenom')} required placeholder="Marie" /></Field>
          <Field label="Nom *"><Input value={form.nom} onChange={set('nom')} required placeholder="Dupont" /></Field>
        </div>

        <Field label="Rôle dans le club">
          <div style={{ display: 'flex', gap: 8 }}>
            {[['joueur','⚽ Joueur'],['benevole','🙋 Bénévole'],['les_deux','⚽🙋 Les deux']].map(([val, label]) => (
              <div key={val} onClick={() => setForm(f => ({ ...f, role_club: val }))}
                style={{ flex: 1, padding: '9px 6px', borderRadius: 9, textAlign: 'center', border: '1.5px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                  borderColor: form.role_club === val ? '#1A5FFF' : '#E2E8F0',
                  background: form.role_club === val ? '#EEF3FF' : '#fff',
                  color: form.role_club === val ? '#1A5FFF' : '#6B7A8D' }}>
                {label}
              </div>
            ))}
          </div>
        </Field>

        {isJoueur && (
          <Field label="Équipe">
            <Select value={form.equipe} onChange={set('equipe')}>
              <option value="">— Aucune équipe —</option>
              {EQUIPES.map(e => <option key={e}>{e}</option>)}
            </Select>
          </Field>
        )}

        <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} placeholder="m.dupont@email.fr" /></Field>
        <Field label="Téléphone"><Input value={form.telephone} onChange={set('telephone')} placeholder="06 12 34 56 78" /></Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Licence">
            <Select value={form.licence_statut} onChange={set('licence_statut')}>
              <option value="valide">Validée</option>
              <option value="en_attente">En attente</option>
              <option value="expiree">Expirée</option>
            </Select>
          </Field>
          <Field label="Cotisation">
            <Select value={form.cotisation_statut} onChange={set('cotisation_statut')}>
              <option value="reglee">Réglée</option>
              <option value="en_attente">En attente</option>
              <option value="en_retard">En retard</option>
            </Select>
          </Field>
        </div>

        <Field label="Date du certificat médical">
          <Input type="date" value={form.certificat_date} onChange={set('certificat_date')} />
        </Field>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <input type="checkbox" id="is_coach" checked={form.is_coach} onChange={set('is_coach')} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          <label htmlFor="is_coach" style={{ fontSize: '0.85rem', color: '#0B1A3E', cursor: 'pointer', fontWeight: 500 }}>🎽 Ce membre est un coach</label>
        </div>
        {form.is_coach && (
          <Field label="Équipe(s) encadrée(s)" style={{ marginTop: 12 }}>
            <Input value={form.equipement_coach || ''} onChange={set('equipement_coach')} placeholder="ex. Senior & U18" />
          </Field>
        )}
      </Modal>
    </PageShell>
  )
}
