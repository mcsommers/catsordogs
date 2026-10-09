import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

type Field = {
  field: string;
  label: string;
  kind: 'single' | 'multi';
  option_category: string;
  allow_custom: boolean;
  max_selected: number | null;
  sort_order: number;
  active: boolean;
};
type Option = {
  category: string;
  value: string;
  description: string | null;
  sort_order: number;
  active: boolean;
};

export default function ProfileQuestions() {
  const [fields, setFields] = useState<Field[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [f, o] = await Promise.all([
      supabase.from('profile_field_defs').select('field, label, kind, option_category, allow_custom, max_selected, sort_order, active').order('sort_order'),
      supabase.from('profile_options').select('category, value, description, sort_order, active').order('sort_order'),
    ]);
    if (f.error || o.error) return setError(f.error?.message ?? o.error?.message ?? 'Could not load questions.');
    setFields(f.data ?? []);
    setOptions(o.data ?? []);
    setError(null);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveField(field: Field) {
    const { error: saveError } = await supabase.from('profile_field_defs').update({
      label: field.label.trim(),
      allow_custom: field.allow_custom,
      max_selected: field.max_selected,
      sort_order: field.sort_order,
      active: field.active,
    }).eq('field', field.field);
    if (saveError) return setError(saveError.message);
    await load();
  }

  async function saveOption(option: Option) {
    const { error: saveError } = await supabase.from('profile_options').update({
      description: option.description?.trim() ? option.description.trim() : null,
      sort_order: option.sort_order,
      active: option.active,
    }).eq('category', option.category).eq('value', option.value);
    if (saveError) return setError(saveError.message);
    await load();
  }

  async function addOption(category: string, value: string, description: string) {
    const { error: saveError } = await supabase.from('profile_options').insert({
      category,
      value: value.trim(),
      description: description.trim() || null,
      sort_order: 100,
      active: true,
    });
    if (saveError) return setError(saveError.message);
    await load();
  }

  async function removeOption(option: Option) {
    if (!window.confirm(`Remove “${option.value}”? People who already chose it keep it until they edit their profile.`)) return;
    const { error: saveError } = await supabase.from('profile_options').delete().eq('category', option.category).eq('value', option.value);
    if (saveError) return setError(saveError.message);
    await load();
  }

  const showMe = options.filter((option) => option.category === 'show_me');

  return (
    <div>
      <h2>Profile questions</h2>
      <p className="muted">
        These are the choices on Build Profile, and the “Show me” filter. You can add, reorder, or
        retire a choice. Retiring one does not erase it from someone who already picked it. A brand-new
        blank on the profile (a new question, not a new choice) still needs a developer, because it is
        a new column in the database.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {fields.map((field) => (
        <FieldEditor
          key={field.field}
          field={field}
          options={options.filter((option) => option.category === field.option_category)}
          onField={setFields}
          onOption={(next) => setOptions((current) => current.map((option) => (
            option.category === next.category && option.value === next.value ? next : option
          )))}
          onSaveField={saveField}
          onSaveOption={saveOption}
          onAdd={addOption}
          onRemove={removeOption}
          fields={fields}
        />
      ))}
      <section className="card">
        <h2>Show me (feed filter)</h2>
        <OptionList
          category="show_me"
          options={showMe}
          onOption={(next) => setOptions((current) => current.map((option) => (
            option.category === next.category && option.value === next.value ? next : option
          )))}
          onSave={saveOption}
          onAdd={addOption}
          onRemove={removeOption}
        />
      </section>
    </div>
  );
}

function FieldEditor({ field, options, fields, onField, onOption, onSaveField, onSaveOption, onAdd, onRemove }: {
  field: Field;
  options: Option[];
  fields: Field[];
  onField: (next: Field[] | ((current: Field[]) => Field[])) => void;
  onOption: (next: Option) => void;
  onSaveField: (field: Field) => void;
  onSaveOption: (option: Option) => void;
  onAdd: (category: string, value: string, description: string) => void;
  onRemove: (option: Option) => void;
}) {
  function patch(partial: Partial<Field>) {
    onField(fields.map((item) => (item.field === field.field ? { ...item, ...partial } : item)));
  }
  const current = fields.find((item) => item.field === field.field) ?? field;
  return (
    <section className="card stack">
      <h2>{current.label}</h2>
      <div className="grid">
        <label>
          Label
          <input value={current.label} onChange={(e) => patch({ label: e.target.value })} />
        </label>
        <label>
          Sort order
          <input type="number" value={current.sort_order} onChange={(e) => patch({ sort_order: Number(e.target.value) })} />
        </label>
        {current.kind === 'multi' ? (
          <label>
            Most someone can pick (blank for no extra limit)
            <input
              type="number"
              min={1}
              value={current.max_selected ?? ''}
              onChange={(e) => patch({ max_selected: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </label>
        ) : null}
      </div>
      <label className="row">
        <input type="checkbox" checked={current.allow_custom} onChange={(e) => patch({ allow_custom: e.target.checked })} />
        Allow a short custom answer
      </label>
      <label className="row">
        <input type="checkbox" checked={current.active} onChange={(e) => patch({ active: e.target.checked })} />
        Question is active
      </label>
      <button className="primary" type="button" onClick={() => onSaveField(current)}>Save question</button>
      <OptionList
        category={current.option_category}
        options={options}
        onOption={onOption}
        onSave={onSaveOption}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    </section>
  );
}

function OptionList({ category, options, onOption, onSave, onAdd, onRemove }: {
  category: string;
  options: Option[];
  onOption: (next: Option) => void;
  onSave: (option: Option) => void;
  onAdd: (category: string, value: string, description: string) => void;
  onRemove: (option: Option) => void;
}) {
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  return (
    <div className="stack">
      {options.map((option) => (
        <div className="row" key={option.value}>
          <strong style={{ minWidth: 140 }}>{option.value}</strong>
          <input
            placeholder="Description (optional)"
            value={option.description ?? ''}
            onChange={(e) => onOption({ ...option, description: e.target.value })}
          />
          <input
            type="number"
            style={{ width: 80 }}
            value={option.sort_order}
            onChange={(e) => onOption({ ...option, sort_order: Number(e.target.value) })}
          />
          <label className="row">
            <input type="checkbox" checked={option.active} onChange={(e) => onOption({ ...option, active: e.target.checked })} />
            Active
          </label>
          <button type="button" onClick={() => onSave(option)}>Save</button>
          <button type="button" onClick={() => onRemove(option)}>Remove</button>
        </div>
      ))}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(category, value, description);
          setValue('');
          setDescription('');
        }}
      >
        <input placeholder="New choice" maxLength={40} value={value} onChange={(e) => setValue(e.target.value)} required />
        <input placeholder="Description (optional)" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className="primary" type="submit">Add choice</button>
      </form>
    </div>
  );
}
