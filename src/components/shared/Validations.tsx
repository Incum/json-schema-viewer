import { RegularNode } from '@stoplight/json-schema-tree';
import { Dictionary } from '@stoplight/types';
import cn from 'classnames';
import { capitalize, keys, omit, pick, pickBy, uniq } from 'lodash';
import { observer } from 'mobx-react-lite';
import * as React from 'react';

export interface IValidations {
  validations: Dictionary<unknown>;
  hideExamples?: boolean;
}

type ValidationFormat = {
  name: string;
  values: string[];
};

export const numberValidationNames = [
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'exclusiveMinimum',
  'exclusiveMaximum',
];

const exampleValidationNames = ['examples'];

const excludedValidations = ['exclusiveMinimum', 'exclusiveMaximum', 'readOnly', 'writeOnly'];

const numberValidationFormatters: Record<string, (value: unknown) => string> = {
  minimum: value => `>= ${value}`,
  exclusiveMinimum: value => `> ${value}`,
  minItems: value => `>= ${value} items`,
  minLength: value => `>= ${value} characters`,
  maximum: value => `<= ${value}`,
  exclusiveMaximum: value => `< ${value}`,
  maxItems: value => `<= ${value} items`,
  maxLength: value => `<= ${value} characters`,
};

const createStringFormatter = (nowrap: boolean | undefined) => (value: unknown) => {
  return nowrap && typeof value === 'string' ? value : JSON.stringify(value);
};

const createValidationsFormatter = (name: string, options?: { exact?: boolean; nowrap?: boolean }) => (
  value: unknown[] | unknown,
): ValidationFormat | null => {
  const values = Array.isArray(value) ? value : [value];
  if (values.length) {
    return {
      name: options?.exact ? name : values.length > 1 ? `${name} values` : `${name} value`,
      values: values.map(createStringFormatter(options?.nowrap)),
    };
  }
  return null;
};

const validationFormatters: Record<string, (value: unknown) => ValidationFormat | null> = {
  enum: createValidationsFormatter('Allowed'),
  examples: createValidationsFormatter('Example'),
  multipleOf: createValidationsFormatter('Multiple of', { exact: true }),
  pattern: createValidationsFormatter('Match pattern', { exact: true, nowrap: true }),
  default: createValidationsFormatter('Default'),
};

const oasFormats = {
  int32: {
    minimum: 0 - 2 ** 31,
    maximum: 2 ** 31 - 1,
  },
  int64: {
    minimum: 0 - 2 ** 63,
    maximum: 2 ** 63 - 1,
  },
  float: {
    minimum: 0 - 2 ** 128,
    maximum: 2 ** 128 - 1,
  },
  double: {
    minimum: 0 - Number.MAX_VALUE,
    maximum: Number.MAX_VALUE,
  },
  byte: {
    pattern: '^[\\w\\d+\\/=]*$',
  },
};

function filterOutOasFormatValidations(format: string, values: Dictionary<unknown>) {
  if (!(format in oasFormats)) return values;

  const newValues = { ...values };

  for (const [key, value] of Object.entries(oasFormats[format])) {
    if (value === newValues[key]) {
      delete newValues[key];
    }
  }

  return newValues;
}

export const Validations = observer<IValidations>(({ validations, hideExamples }) => {
  const numberValidations = pick(validations, numberValidationNames);
  const booleanValidations = omit(
    pickBy(validations, v => ['true', 'false'].includes(String(v))),
    excludedValidations,
  );
  const keyValueValidations = omit(validations, [
    ...keys(numberValidations),
    ...keys(booleanValidations),
    ...excludedValidations,
    ...(hideExamples ? exampleValidationNames : []),
  ]);

  return (
    <>
      <NumberValidations validations={numberValidations} />
      <KeyValueValidations validations={keyValueValidations} />
      <NameValidations validations={booleanValidations} />
    </>
  );
});

const NumberValidations = ({
  validations,
}: {
  validations: Partial<Record<typeof numberValidationNames[number], unknown>>;
}) => {
  const entries = Object.entries(validations);
  if (!entries.length) {
    return null;
  }
  return (
    <div className="sl-flex sl-my-2 sl-text-muted">
      {entries
        .map(([key, value]) => numberValidationFormatters[key](value))
        .map((value, i) => (
          <Value key={i} name={value} className="sl-mr-2" />
        ))}
    </div>
  );
};

const KeyValueValidations = ({ validations }: { validations: Dictionary<unknown> }) => (
  <>
    {keys(validations)
      .filter(key => Object.keys(validationFormatters).includes(key))
      .map(key => {
        const validation = validationFormatters[key](validations[key]);
        if (validation) {
          return <KeyValueValidation key={key} name={validation.name} values={validation.values} />;
        } else {
          return null;
        }
      })}
  </>
);

const KeyValueValidation = ({ name, values }: { name: string; values: string[] }) => {
  return (
    <div className="sl-flex sl-flex-wrap sl-text-muted sl-my-2">
      <span className="sl-text-light">{capitalize(name)}:</span>
      {uniq(values).map(value => (
        <Value key={value} name={value} className="sl-ml-2" />
      ))}
    </div>
  );
};

const NameValidations = ({ validations }: { validations: Dictionary<unknown> }) => (
  <>
    {keys(validations).length ? (
      <div className="sl-flex sl-flex-wrap sl-my-2">
        {keys(validations)
          .filter(key => validations[key])
          .map(key => (
            <Value key={key} name={key} className="sl-mr-2 sl-text-muted sl-capitalize" />
          ))}
      </div>
    ) : null}
  </>
);

const Value = ({ name, className }: { name: string; className?: string }) => (
  <span
    className={cn('sl-px-1 sl-font-mono sl-border sl-rounded-lg', className)}
    style={{ backgroundColor: '#EDF2F7' }}
  >
    {name}
  </span>
);

export function validationCount(schemaNode: RegularNode) {
  const validations = getValidationsFromSchema(schemaNode);
  const validationKeys = keys(omit(validations, excludedValidations));
  return uniq(validationKeys.map(key => ([...numberValidationNames].includes(key) ? 'number' : key))).length;
}

export function getValidationsFromSchema(schemaNode: RegularNode) {
  return {
    ...(schemaNode.enum !== null ? { enum: schemaNode.enum } : null),
    ...('annotations' in schemaNode
      ? {
          ...(schemaNode.annotations.default ? { default: schemaNode.annotations.default } : null),
          ...(schemaNode.annotations.examples ? { examples: schemaNode.annotations.examples } : null),
        }
      : null),
    ...getFilteredValidations(schemaNode),
  };
}

function getFilteredValidations(schemaNode: RegularNode) {
  if (schemaNode.format !== null) {
    return filterOutOasFormatValidations(schemaNode.format, schemaNode.validations);
  }

  return schemaNode.validations;
}
