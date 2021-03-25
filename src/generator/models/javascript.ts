import { DMMF } from '@prisma/client/runtime'
import endent from 'endent'
import { chain } from 'lodash'
import * as Nexus from 'nexus'
import { NexusEnumTypeConfig, NexusListDef, NexusNonNullDef, NexusNullDef } from 'nexus/dist/core'
import { ModuleSpec } from '../types'
import { fieldTypeToGraphQLType } from './declaration'

type PrismaEnumName = string

type PrismaModelName = string

type PrismaModelOrEnumName = string

type PrismaFieldName = string

type PrismaModelFieldNameOrMetadataFieldName = string

type NexusTypeDefConfigurations = Record<
  PrismaModelOrEnumName,
  NexusObjectTypeDefConfiguration | NexusEnumTypeDefConfiguration
>

/**
 * Create the module specification for the JavaScript runtime.
 */
export function createModuleSpec(): ModuleSpec {
  return {
    fileName: 'index.js',
    content: endent`
      const { getPrismaClientDmmf } = require('../helpers/prisma')
      const ModelsGenerator = require('../generator/models')

      const dmmf = getPrismaClientDmmf()
      const models = ModelsGenerator.JS.createNexusTypeDefConfigurations(dmmf)

      module.exports = models
    `,
  }
}

export function createNexusTypeDefConfigurations(dmmf: DMMF.Document): NexusTypeDefConfigurations {
  return {
    ...createNexusObjectTypeDefConfigurations(dmmf),
    ...createNexusEnumTypeDefConfigurations(dmmf),
  }
}

type NexusObjectTypeDefConfigurations = Record<PrismaModelName, NexusObjectTypeDefConfiguration>

type NexusObjectTypeDefConfiguration = Record<
  PrismaModelFieldNameOrMetadataFieldName,
  | {
      name: PrismaFieldName
      type: NexusNonNullDef<string> | NexusListDef<string> | NexusNullDef<string>
      description: string
    }
  // Metadata fields can be any of these
  | string
  | null
>

/**
 * Create Nexus object type definition configurations for Prisma models found in the given DMMF.
 */
function createNexusObjectTypeDefConfigurations(dmmf: DMMF.Document): NexusObjectTypeDefConfigurations {
  return chain(dmmf.datamodel.models)
    .map((model) => {
      return {
        $name: model.name,
        $description: model.documentation ?? null,
        ...chain(model.fields)
          .map((field) => {
            return {
              name: field.name,
              type: prismaFieldToNexusType(field),
              description: field.documentation ?? null,
            }
          })
          .keyBy('name')
          .value(),
      }
    })
    .keyBy('$name')
    .value()
}

// Complex return type I don't really understand how to easily work with manually.
// eslint-disable-next-line
export function prismaFieldToNexusType(field: DMMF.Field) {
  const graphqlType = fieldTypeToGraphQLType(field)

  if (field.isList) {
    return Nexus.nonNull(Nexus.list(Nexus.nonNull(graphqlType)))
  } else if (field.isRequired) {
    return Nexus.nonNull(graphqlType)
  } else {
    return Nexus.nullable(graphqlType)
  }
}

type AnyNexusEnumTypeConfig = NexusEnumTypeConfig<string>

type NexusEnumTypeDefConfigurations = Record<PrismaEnumName, NexusEnumTypeDefConfiguration>

type NexusEnumTypeDefConfiguration = AnyNexusEnumTypeConfig

/**
 * Create Nexus enum type definition configurations for Prisma enums found in the given DMMF.
 */
function createNexusEnumTypeDefConfigurations(dmmf: DMMF.Document): NexusEnumTypeDefConfigurations {
  return chain(dmmf.datamodel.enums)
    .map(
      (enum_): AnyNexusEnumTypeConfig => {
        return {
          name: enum_.name,
          description: enum_.documentation,
          members: enum_.values.map((val) => val.name),
        }
      }
    )
    .keyBy('name')
    .value()
}