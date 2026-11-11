"use client";

import { useActionState } from "react";
import type { SettingField } from "@/core/plugins/manifest";
import type { SettingValue } from "@/core/plugins/settings";
import { strings } from "@/core/strings";
import { Button, Field, Notice } from "@/ui/controls";
import { Panel, PanelForm } from "@/ui/Panel";
import { saveSettingsAction, type SettingsState } from "./actions";
import styles from "./settings.module.css";

type Props = {
  pluginId: string;
  scope: "global" | "personal";
  title: string;
  help: string;
  fields: SettingField[];
  values: Record<string, SettingValue>;
};

function Input({ field, value }: { field: SettingField; value: SettingValue }) {
  const t = strings.pluginSettings;
  const name = `setting.${field.key}`;
  if (field.type === "boolean") {
    return (
      <label className={styles.check}>
        <input type="checkbox" name={name} defaultChecked={value === true} />
        <span>
          <span className={styles.label}>{field.label}</span>
          {field.description && <span className={styles.hint}>{field.description}</span>}
        </span>
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`field-${name}`}>
          {field.label}
        </label>
        <select className={styles.select} id={`field-${name}`} name={name} defaultValue={typeof value === "string" ? value : ""} required={field.required}>
          {!field.required && <option value="">{t.none}</option>}
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {field.description && <span className={styles.hint}>{field.description}</span>}
      </div>
    );
  }
  if (field.type === "secret") {
    return (
      <div className={styles.field}>
        <Field
          label={field.label}
          name={name}
          type="password"
          autoComplete="off"
          placeholder={value === true ? t.secretSaved : ""}
          hint={[field.description, value === true ? t.secretKeep : undefined].filter(Boolean).join(" ")}
        />
        {value === true && !field.required && (
          <label className={styles.check}>
            <input type="checkbox" name="clear" value={field.key} />
            <span className={styles.hint}>{t.secretClear}</span>
          </label>
        )}
      </div>
    );
  }
  return (
    <Field
      label={field.label}
      name={name}
      type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
      multiline={field.type === "textarea"}
      defaultValue={value === null || value === true || value === false ? "" : String(value)}
      min={field.min}
      max={field.max}
      required={field.required}
      hint={field.description}
    />
  );
}

export function SettingsForm({ pluginId, scope, title, help, fields, values }: Props) {
  const [state, action, pending] = useActionState(saveSettingsAction.bind(null, pluginId, scope), {} as SettingsState);
  return (
    <Panel title={title}>
      <PanelForm>
        <form className={styles.form} action={action}>
          <p className={styles.hint}>{help}</p>
          {state.error && <Notice tone="error">{state.error}</Notice>}
          {state.saved && <Notice tone="success">{strings.pluginSettings.saved}</Notice>}
          {fields.map((field) => (
            <Input key={field.key} field={field} value={values[field.key] ?? null} />
          ))}
          <div>
            <Button variant="primary" type="submit" icon="check" disabled={pending}>
              {strings.pluginSettings.save}
            </Button>
          </div>
        </form>
      </PanelForm>
    </Panel>
  );
}
