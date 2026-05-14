import { PlistUID } from '../../../lib/plist/index.js';
import { NSKeyedArchiverEncoder } from '../dvt/nskeyedarchiver-encoder.js';

type NSMutableArrayMarker = {
  __type: 'NSMutableArray';
  items: any[];
};

type XCPointerEventMarker = {
  __type: 'XCPointerEvent';
  fields: Record<string, any>;
};

type XCPointerEventPathMarker = {
  __type: 'XCPointerEventPath';
  fields: Record<string, any>;
};

type XCSynthesizedEventRecordMarker = {
  __type: 'XCSynthesizedEventRecord';
  fields: Record<string, any>;
};

/**
 * Extended NSKeyedArchiver encoder that handles testmanagerd-specific
 * marker types: NSUUID and XCTCapabilities.
 *
 * Marker objects use a `__type` discriminator field so the encoder can
 * distinguish them from plain dictionaries.
 *
 * Callers must pass **canonical** UUID strings for `NSUUID` markers; this
 * encoder does not validate or normalize (see {@link archiveNSUUID}).
 */
export class TestmanagerdEncoder extends NSKeyedArchiverEncoder {
  protected override archiveObject(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (value && typeof value === 'object' && value.__type) {
      switch (value.__type) {
        case 'NSUUID':
          return this.archiveNSUUID(value.uuid);
        case 'XCTCapabilities':
          return this.archiveXCTCapabilities(value.capabilities ?? {});
        case 'NSMutableArray':
          return this.archiveNSMutableArray(
            (value as NSMutableArrayMarker).items,
          );
        case 'XCPointerEvent':
          return this.archiveCustomFieldsObject(
            'XCPointerEvent',
            (value as XCPointerEventMarker).fields,
          );
        case 'XCPointerEventPath':
          return this.archiveCustomFieldsObject(
            'XCPointerEventPath',
            (value as XCPointerEventPathMarker).fields,
          );
        case 'XCSynthesizedEventRecord':
          return this.archiveCustomFieldsObject(
            'XCSynthesizedEventRecord',
            (value as XCSynthesizedEventRecordMarker).fields,
          );
      }
    }

    return super.archiveObject(value);
  }

  /**
   * @param uuidString Canonical RFC-4122 string with dashes (32 hex digits when
   * dashes are stripped). Callers should use `crypto.randomUUID()` or
   * `canonicalizeUuidString` from `./uuid.js` before encoding; this method does
   * not validate.
   */
  private archiveNSUUID(uuidString: string): number {
    const index = this.objects.length;
    this.objects.push(null); // Placeholder

    const uuidBytes = Buffer.from(uuidString.replace(/-/g, ''), 'hex');
    const classUid = this.getClassUid('NSUUID', 'NSObject');

    this.objects[index] = {
      'NS.uuidbytes': uuidBytes,
      $class: new PlistUID(classUid),
    };

    return index;
  }

  private archiveXCTCapabilities(capabilities: Record<string, any>): number {
    const index = this.objects.length;
    this.objects.push(null); // Placeholder

    const dictIndex = this.archiveDictionary(capabilities);
    const classUid = this.getClassUid('XCTCapabilities', 'NSObject');

    this.objects[index] = {
      'capabilities-dictionary': new PlistUID(dictIndex),
      $class: new PlistUID(classUid),
    };

    return index;
  }

  private archiveNSMutableArray(items: any[]): number {
    const index = this.objects.length;
    this.objects.push(null);

    const itemUids = items.map(
      (item) => new PlistUID(this.archiveObject(item)),
    );
    const classUid = this.getClassUid('NSMutableArray', 'NSArray', 'NSObject');

    this.objects[index] = {
      'NS.objects': itemUids,
      $class: new PlistUID(classUid),
    };

    return index;
  }

  private archiveCustomFieldsObject(
    className: string,
    fields: Record<string, any>,
  ): number {
    const index = this.objects.length;
    this.objects.push(null);

    const archivedFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
      archivedFields[key] =
        value instanceof PlistUID
          ? value
          : new PlistUID(this.archiveObject(value));
    }

    const classUid = this.getClassUid(className, 'NSObject');

    this.objects[index] = {
      ...archivedFields,
      $class: new PlistUID(classUid),
    };

    return index;
  }
}
