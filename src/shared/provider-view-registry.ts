export class RetainedViewRegistry<Key, View> {
  private readonly views = new Map<Key, View>()

  get(key: Key): View | undefined {
    return this.views.get(key)
  }

  getOrCreate(key: Key, create: () => View, isValid: (view: View) => boolean = () => true): View {
    const existing = this.views.get(key)
    if (existing && isValid(existing)) return existing
    const view = create()
    this.views.set(key, view)
    return view
  }

  entries(): IterableIterator<[Key, View]> {
    return this.views.entries()
  }
}
